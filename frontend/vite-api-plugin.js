/**
 * Vite plugin that embeds the backend API handlers directly into the Vite dev server.
 * This eliminates the need for a separate backend process during development.
 * 
 * Handles:  POST /api/generate
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = join(__dirname, '..', 'backend');

// Load backend .env files into process.env
function loadEnvFile(filePath) {
  try {
    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch { /* file may not exist */ }
}

loadEnvFile(join(backendDir, '.env.local'));
loadEnvFile(join(backendDir, '.env'));

// Import backend modules using CJS require
const require = createRequire(import.meta.url);
const { executeGenerate } = require(join(backendDir, 'lib', 'executeGenerate.js'));
const { callCopilotChat } = require(join(backendDir, 'lib', 'ai.js'));

const LOG = '[mechagen-api]';
const PLUGIN_VERSION = 2;

/** Pathname only — req.url can include ?query */
function apiPath(url) {
  if (!url) return '';
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

export default function apiPlugin() {
  return {
    name: 'mechagen-api',
    configureServer(server) {
      // Same process as Vite — all backend console.log/error goes to THIS terminal.
      console.log(
        `\n${LOG} plugin v${PLUGIN_VERSION} — POST /api/ai/chat uses NVIDIA (callCopilotChat). If the UI says "not configured yet", restart \`npm run dev\` and pull latest code.\n` +
          `${LOG} Backend runs inside Vite — logs: [executeGenerate], [AI], [mechagen-api].\n` +
          `${LOG} GET http://localhost:PORT/api/health to verify this plugin is active.\n`
      );

      server.middlewares.use(async (req, res, next) => {
        // Only handle /api routes
        if (!req.url?.startsWith('/api/')) return next();

        const path = apiPath(req.url);

        if (req.method === 'GET' && path === '/api/health') {
          return sendJson(res, 200, {
            ok: true,
            plugin: 'mechagen-vite-api',
            version: PLUGIN_VERSION,
            chat: 'callCopilotChat',
            backendDir,
          });
        }

        // CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        // POST /api/generate
        if (path === '/api/generate' && req.method === 'POST') {
          let body;
          try { body = await readBody(req); }
          catch { return sendJson(res, 400, { error: 'Invalid JSON body' }); }

          const t0 = Date.now();
          const promptPreview = (body?.prompt || '').toString().replace(/\s+/g, ' ').slice(0, 100);
          console.log(`${LOG} POST /api/generate start — prompt: "${promptPreview}${promptPreview.length >= 100 ? '…' : ''}"`);

          try {
            const out = await executeGenerate(body);
            const stlLen = typeof out.stl === 'string' ? out.stl.length : 0;
            const codeLen = typeof out.code === 'string' ? out.code.length : 0;
            const nParts = Array.isArray(out.parts) ? out.parts.length : 0;
            const ms = Date.now() - t0;
            console.log(
              `${LOG} POST /api/generate OK in ${ms}ms — stlB64=${stlLen} codeChars=${codeLen} parts=${nParts}`
            );
            return sendJson(res, 200, {
              stl: out.stl,
              code: out.code,
              name: out.name,
              parts: out.parts,
              description: out.description,
              dimensions: out.dimensions,
            });
          } catch (err) {
            const status = err.status ?? 500;
            const ms = Date.now() - t0;
            console.error(`${LOG} POST /api/generate FAIL in ${ms}ms (${status}):`, err.message);
            if (err.stack) console.error(err.stack);
            return sendJson(res, status, { error: err.message });
          }
        }

        // /api/projects/* — return empty array (stub)
        if (path.startsWith('/api/projects/')) {
          return sendJson(res, 200, []);
        }

        // POST /api/ai/chat — engineering co-pilot (NVIDIA chat completions)
        if (path === '/api/ai/chat' && req.method === 'POST') {
          let body;
          try { body = await readBody(req); }
          catch { return sendJson(res, 400, { error: 'Invalid JSON body' }); }
          const msg = body?.message;
          if (!msg || typeof msg !== 'string' || !msg.trim()) {
            return sendJson(res, 400, { error: 'Message is required' });
          }
          const ct0 = Date.now();
          console.log(`${LOG} POST /api/ai/chat — "${String(msg).slice(0, 80)}${String(msg).length > 80 ? '…' : ''}"`);
          try {
            const reply = await callCopilotChat(msg.trim());
            console.log(`${LOG} POST /api/ai/chat OK in ${Date.now() - ct0}ms`);
            return sendJson(res, 200, { reply });
          } catch (err) {
            const st = Number(err.status);
            const status = st >= 400 && st < 600 ? st : 500;
            console.error(`${LOG} POST /api/ai/chat FAIL in ${Date.now() - ct0}ms:`, err.message);
            return sendJson(res, status, { error: err.message || 'Chat failed' });
          }
        }
        // /api/ai/improve-prompt — stub that returns the prompt unchanged
        if (path === '/api/ai/improve-prompt' && req.method === 'POST') {
          let body;
          try { body = await readBody(req); }
          catch { return sendJson(res, 400, { error: 'Invalid JSON body' }); }
          return sendJson(res, 200, {
            improvedPrompt: (body.prompt || '').trim(),
          });
        }

        return sendJson(res, 404, { error: `No API route: ${req.method} ${path}` });

      });
    },
  };
}
