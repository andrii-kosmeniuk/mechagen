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
      server.middlewares.use(async (req, res, next) => {
        // Only handle /api routes
        if (!req.url?.startsWith('/api/')) return next();

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
        if (req.url === '/api/generate' && req.method === 'POST') {
          let body;
          try { body = await readBody(req); }
          catch { return sendJson(res, 400, { error: 'Invalid JSON body' }); }

          try {
            const out = await executeGenerate(body);
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
            console.error('[api/generate]', err.message);
            return sendJson(res, status, { error: err.message });
          }
        }

        // /api/projects/* — return empty array (stub)
        if (req.url?.startsWith('/api/projects/')) {
          return sendJson(res, 200, []);
        }

        // /api/ai/chat — stub
        if (req.url === '/api/ai/chat' && req.method === 'POST') {
          let body;
          try { body = await readBody(req); }
          catch { return sendJson(res, 400, { error: 'Invalid JSON body' }); }
          return sendJson(res, 200, { reply: 'AI chat is not configured yet.' });
        }
        // /api/ai/improve-prompt — stub that returns the prompt unchanged
        if (req.url === '/api/ai/improve-prompt' && req.method === 'POST') {
          let body;
          try { body = await readBody(req); }
          catch { return sendJson(res, 400, { error: 'Invalid JSON body' }); }
          return sendJson(res, 200, {
            improvedPrompt: (body.prompt || '').trim(),
          });
        }

        return sendJson(res, 404, { error: `No API route: ${req.method} ${req.url}` });

      });
    },
  };
}
