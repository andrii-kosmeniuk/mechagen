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
// Phase 2
const blueprintUploadHandler = require('./src/api/blueprintUpload');
const { analyzeHandler: blueprintAnalyzeHandler, getHandler: blueprintGetHandler } = require('./src/api/blueprintAnalyze');
const { statusHandler: exportStatusHandler, objHandler: exportObjHandler, glbHandler: exportGlbHandler, stlHandler: exportStlHandler } = require('./src/api/exportHandler');
const { projectHistoryHandler, generationTimelineHandler } = require('./src/api/historyHandler');
// Phase 3
const { solidStartHandler, solidStatusHandler } = require('./src/api/solidBuildHandler');

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

  // Serve uploaded files statically (/uploads/...)
  if (url.pathname.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, url.pathname);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.pdf':'application/pdf', '.obj':'model/obj', '.glb':'model/gltf-binary' };
    const mime = mimeMap[ext] || 'application/octet-stream';
    rawRes.writeHead(200, { ...res._headers, 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(rawRes);
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

  // ── Phase 2: Blueprint routes ────────────────────────────────────────────
  // POST /api/blueprints/upload  (multipart)
  if (url.pathname === '/api/blueprints/upload' && req.method === 'POST') {
    req.params = {};
    await blueprintUploadHandler(req, res);
    return;
  }

  // GET  /api/blueprints/:id
  const bpGetMatch = url.pathname.match(/^\/api\/blueprints\/([^/]+)$/);
  if (bpGetMatch && req.method === 'GET') {
    req.params = { id: bpGetMatch[1] };
    await blueprintGetHandler(req, res);
    return;
  }

  // POST /api/blueprints/:id/analyze
  const bpAnalyzeMatch = url.pathname.match(/^\/api\/blueprints\/([^/]+)\/analyze$/);
  if (bpAnalyzeMatch && req.method === 'POST') {
    req.params = { id: bpAnalyzeMatch[1] };
    await blueprintAnalyzeHandler(req, res);
    return;
  }

  // GET /api/generations/:id/export/status|obj|glb|stl
  const exportMatch = url.pathname.match(/^\/api\/generations\/([^/]+)\/export\/(status|obj|glb|stl)$/);
  if (exportMatch && req.method === 'GET') {
    req.params = { id: exportMatch[1] };
    if (exportMatch[2] === 'status') { await exportStatusHandler(req, res); return; }
    if (exportMatch[2] === 'obj')    { await exportObjHandler(req, res); return; }
    if (exportMatch[2] === 'glb')    { await exportGlbHandler(req, res); return; }
    if (exportMatch[2] === 'stl')    { await exportStlHandler(req, res); return; }
  }

  // ── Phase 3: Solid build routes ───────────────────────────────────────────
  // POST /api/generations/:id/solid/start
  const solidStartMatch = url.pathname.match(/^\/api\/generations\/([^/]+)\/solid\/start$/);
  if (solidStartMatch && req.method === 'POST') {
    req.params = { id: solidStartMatch[1] };
    req.body = req.body || await readBody(req).catch(() => ({}));
    await solidStartHandler(req, res);
    return;
  }

  // GET /api/generations/:id/solid/status
  const solidStatusMatch = url.pathname.match(/^\/api\/generations\/([^/]+)\/solid\/status$/);
  if (solidStatusMatch && req.method === 'GET') {
    req.params = { id: solidStatusMatch[1] };
    await solidStatusHandler(req, res);
    return;
  }

  // GET /api/generations/:id/timeline
  const timelineMatch = url.pathname.match(/^\/api\/generations\/([^/]+)\/timeline$/);
  if (timelineMatch && req.method === 'GET') {
    req.params = { id: timelineMatch[1] };
    await generationTimelineHandler(req, res);
    return;
  }

  // GET /api/projects/:projectId/history
  const historyMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/history$/);
  if (historyMatch && req.method === 'GET') {
    req.params = { projectId: historyMatch[1] };
    await projectHistoryHandler(req, res);
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
  console.log('[server]           GET  /api/generations/:id/export/status|obj|glb');
  console.log('[server]           GET  /api/generations/:id/timeline');
  console.log('[server]           GET  /api/catalog/part-types');
  console.log('[server] Phase 2:  POST /api/blueprints/upload');
  console.log('[server]           GET  /api/blueprints/:id');
  console.log('[server]           POST /api/blueprints/:id/analyze');
  console.log('[server]           GET  /api/projects/:projectId/history');
  console.log('[server]           GET  /api/health');
});
