'use strict';

/**
 * Standalone Express server — replaces `vercel dev` for local development.
 * Listens on port 3001 (same as vercel dev --listen 3001).
 * Zero npm dependencies beyond Node.js built-ins.
 */

// Load env files (.env.local takes precedence over .env)
const fs   = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
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

loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, '.env'));

const http = require('http');
const { URL }  = require('url');

const generateHandler     = require('./api/generate');
const chatHandler         = require('./api/ai/chat');
const pipelineGenHandler  = require('./src/api/pipelineGenerate');
const { getGenerationHandler, repairHandler } = require('./src/api/generations');
const catalogHandler      = require('./src/api/catalog');

const PORT = process.env.PORT || 3001;

// Minimal request body parser
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// Minimal response wrapper matching Express-like API
function makeRes(rawRes) {
  const res = {
    _status: 200,
    _headers: {},
    status(code) { res._status = code; return res; },
    setHeader(k, v) { res._headers[k] = v; return res; },
    end() {
      rawRes.writeHead(res._status, res._headers);
      rawRes.end();
    },
    json(obj) {
      res._headers['Content-Type'] = 'application/json';
      rawRes.writeHead(res._status, res._headers);
      rawRes.end(JSON.stringify(obj));
    },
  };
  return res;
}

const server = http.createServer(async (req, rawRes) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const res = makeRes(rawRes);

  // CORS preflight for all routes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    rawRes.writeHead(204, res._headers);
    rawRes.end();
    return;
  }

  if (url.pathname === '/api/generate') {
    try {
      req.body = await readBody(req);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    await generateHandler(req, res);
    return;
  }

  if (url.pathname === '/api/ai/chat') {
    try {
      req.body = await readBody(req);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    await chatHandler(req, res);
    return;
  }

  // ── New structured pipeline routes ────────────────────────────────────────
  if (url.pathname === '/api/pipeline/generate') {
    try {
      req.body = await readBody(req);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    await pipelineGenHandler(req, res);
    return;
  }

  // GET /api/generations/:id
  const genMatch = url.pathname.match(/^\/api\/generations\/([^/]+)$/);
  if (genMatch) {
    await getGenerationHandler(req, res, genMatch[1]);
    return;
  }

  // POST /api/generations/:id/repair
  const repairMatch = url.pathname.match(/^\/api\/generations\/([^/]+)\/repair$/);
  if (repairMatch) {
    await repairHandler(req, res, repairMatch[1]);
    return;
  }

  // GET /api/catalog/part-types
  if (url.pathname === '/api/catalog/part-types') {
    await catalogHandler(req, res);
    return;
  }

  // GET /api/health
  if (url.pathname === '/api/health') {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  // Catch-all 404
  res.status(404).json({ error: `No route for ${req.method} ${url.pathname}` });
});

server.on('error', (err) => {
  if (err.code === 'EPERM' || err.code === 'EACCES') {
    console.error(`[server] Cannot bind port ${PORT} — macOS firewall may be blocking it.`);
    console.error('[server] Open System Settings → Privacy & Security → Firewall → Allow node');
    console.error('[server] Or try: sudo node server.js');
  } else if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} is already in use`);
  } else {
    console.error('[server] Error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] listening on http://127.0.0.1:${PORT}`);
  console.log('[server] Legacy:   POST /api/generate  POST /api/ai/chat');
  console.log('[server] Pipeline: POST /api/pipeline/generate');
  console.log('[server]           GET  /api/generations/:id');
  console.log('[server]           POST /api/generations/:id/repair');
  console.log('[server]           GET  /api/catalog/part-types');
  console.log('[server]           GET  /api/health');
});
