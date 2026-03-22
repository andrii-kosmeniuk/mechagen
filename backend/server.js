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

const generateHandler = require('./api/generate');
const chatHandler = require('./api/ai/chat');

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
  console.log('[server] API: POST /api/generate  POST /api/ai/chat');
});
