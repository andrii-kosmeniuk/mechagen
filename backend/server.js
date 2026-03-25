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
// Phase 4
const { authMiddleware }  = require('./src/middleware/auth');
const { rateLimitMiddleware } = require('./src/middleware/rateLimiter');
const { planGate }        = require('./src/middleware/planGate');
const { listPlans, getMyPlan, setMyPlan } = require('./src/api/planHandler');
const { getMyUsage, getMyUsageEvents, getWorkspaceUsage } = require('./src/api/usageHandler');
const { listMyWorkspaces, createWorkspace, getWorkspace, updateWorkspace, deleteWorkspace,
        listMembers, addMember, updateMemberRole, removeMember } = require('./src/api/workspaceHandler');
const { getMetrics, getCredits, setUserPlanAdmin, addUserCredits, listSubscriptions } = require('./src/api/adminHandler');
const { requireAdmin }    = require('./src/middleware/auth');
// Phase 5
const { getOnboarding, advanceStep, completeOnboarding, skipOnboarding } = require('./src/api/onboardingHandler');
const { trackEvent, getSummary: getAnalyticsSummaryH, getRecent: getAnalyticsRecentH } = require('./src/api/analyticsHandler');
const { submitWaitlist, checkWaitlistStatus, getAdminWaitlist } = require('./src/api/waitlistHandler');
const { submitFeedbackHandler, getAdminFeedback, updateFeedbackStatusHandler } = require('./src/api/feedbackHandler');
const { getDemoProjectHandler, getDemoGenerationsHandler, getDemoBlueprintHandler, resetDemoHandler } = require('./src/api/demoHandler');
const { getLaunchSummaryHandler, getOnboardingFunnelHandler, getAnalyticsSummaryHandler } = require('./src/api/launchAdminHandler');

// ── Seed on startup ────────────────────────────────────────────────────────────
require('./seed/plans')();
require('./seed/workspaces')();
require('./seed/demo')();

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
    set(k, v) { res._headers[k] = v; return res; },   // Express compat
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

  // CORS — include Phase 4 headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Key,Authorization');

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
    res.status(200).json({ status: 'ok', version: 'phase4', timestamp: new Date().toISOString() });
    return;
  }

  // ── Phase 4: Plan & Usage routes ─────────────────────────────────────────
  // Helper: run through middleware chain then handler
  async function runChain(middlewares, handler) {
    let i = 0;
    const next = async (err) => {
      if (err) { res.status(err.status || 500).json({ error: err.message, code: err.code }); return; }
      if (i < middlewares.length) { const mw = middlewares[i++]; await mw(req, res, next); }
      else await handler(req, res);
    };
    await next();
  }

  // GET /api/plans
  if (url.pathname === '/api/plans' && req.method === 'GET') {
    await listPlans(req, res); return;
  }
  // GET /api/me/plan
  if (url.pathname === '/api/me/plan' && req.method === 'GET') {
    await runChain([authMiddleware], getMyPlan); return;
  }
  // POST /api/me/plan
  if (url.pathname === '/api/me/plan' && req.method === 'POST') {
    req.body = await readBody(req).catch(() => ({}));
    await runChain([authMiddleware], setMyPlan); return;
  }
  // GET /api/me/usage
  if (url.pathname === '/api/me/usage' && req.method === 'GET') {
    await runChain([authMiddleware], getMyUsage); return;
  }
  // GET /api/me/usage/events
  if (url.pathname === '/api/me/usage/events' && req.method === 'GET') {
    req.query = Object.fromEntries(url.searchParams);
    await runChain([authMiddleware], getMyUsageEvents); return;
  }

  // ── Phase 4: Workspace routes ─────────────────────────────────────────────
  if (url.pathname === '/api/workspaces' && req.method === 'GET') {
    await runChain([authMiddleware], listMyWorkspaces); return;
  }
  if (url.pathname === '/api/workspaces' && req.method === 'POST') {
    req.body = await readBody(req).catch(() => ({}));
    await runChain([authMiddleware], createWorkspace); return;
  }
  const wsMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)$/);
  if (wsMatch) {
    req.params = { id: wsMatch[1] };
    if (req.method === 'GET')    { await runChain([authMiddleware], getWorkspace); return; }
    if (req.method === 'PATCH')  { req.body = await readBody(req).catch(() => ({})); await runChain([authMiddleware], updateWorkspace); return; }
    if (req.method === 'DELETE') { await runChain([authMiddleware], deleteWorkspace); return; }
  }
  const wsMembersMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/members$/);
  if (wsMembersMatch) {
    req.params = { id: wsMembersMatch[1] };
    if (req.method === 'GET')  { await runChain([authMiddleware], listMembers); return; }
    if (req.method === 'POST') { req.body = await readBody(req).catch(() => ({})); await runChain([authMiddleware], addMember); return; }
  }
  const wsMemberMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/);
  if (wsMemberMatch) {
    req.params = { id: wsMemberMatch[1], uid: wsMemberMatch[2] };
    if (req.method === 'PATCH')  { req.body = await readBody(req).catch(() => ({})); await runChain([authMiddleware], updateMemberRole); return; }
    if (req.method === 'DELETE') { await runChain([authMiddleware], removeMember); return; }
  }
  // GET /api/workspaces/:id/usage
  const wsUsageMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/usage$/);
  if (wsUsageMatch && req.method === 'GET') {
    req.params = { id: wsUsageMatch[1] };
    await runChain([authMiddleware], getWorkspaceUsage); return;
  }

  // ── Phase 4: Admin routes ─────────────────────────────────────────────────
  if (url.pathname === '/api/admin/metrics' && req.method === 'GET') {
    await runChain([authMiddleware, requireAdmin], getMetrics); return;
  }
  if (url.pathname === '/api/admin/credits' && req.method === 'GET') {
    await runChain([authMiddleware, requireAdmin], getCredits); return;
  }
  if (url.pathname === '/api/admin/subscriptions' && req.method === 'GET') {
    await runChain([authMiddleware, requireAdmin], listSubscriptions); return;
  }
  const adminPlanMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/plan$/);
  if (adminPlanMatch && req.method === 'POST') {
    req.body = await readBody(req).catch(() => ({}));
    req.params = { userId: adminPlanMatch[1] };
    await runChain([authMiddleware, requireAdmin], setUserPlanAdmin); return;
  }
  const adminCreditsMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/credits$/);
  if (adminCreditsMatch && req.method === 'POST') {
    req.body = await readBody(req).catch(() => ({}));
    req.params = { userId: adminCreditsMatch[1] };
    await runChain([authMiddleware, requireAdmin], addUserCredits); return;
  }

  // ── Phase 5: Public routes (no auth) ─────────────────────────────────────────

  // Landing page — serve static HTML
  if ((url.pathname === '/' || url.pathname === '/landing') && req.method === 'GET') {
    const landingPath = path.join(__dirname, 'landing', 'index.html');
    if (fs.existsSync(landingPath)) {
      rawRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...res._headers });
      fs.createReadStream(landingPath).pipe(rawRes);
    } else {
      res.status(200).json({ message: 'MechaGen API — landing page not built yet', version: 'phase5' });
    }
    return;
  }

  // POST /api/analytics/track (public)
  if (url.pathname === '/api/analytics/track' && req.method === 'POST') {
    req.body = await readBody(req).catch(() => ({}));
    await trackEvent(req, res); return;
  }

  // POST /api/waitlist  GET /api/waitlist/status
  if (url.pathname === '/api/waitlist' && req.method === 'POST') {
    req.body = await readBody(req).catch(() => ({}));
    await submitWaitlist(req, res); return;
  }
  if (url.pathname === '/api/waitlist/status' && req.method === 'GET') {
    req.query = Object.fromEntries(url.searchParams);
    await checkWaitlistStatus(req, res); return;
  }

  // POST /api/feedback (auth optional)
  if (url.pathname === '/api/feedback' && req.method === 'POST') {
    req.body = await readBody(req).catch(() => ({}));
    // Try to auth but don't block if no key
    try { await new Promise(r => authMiddleware(req, res, r)); } catch { req.user = null; }
    await submitFeedbackHandler(req, res); return;
  }

  // GET /api/demo/*  (public)
  if (url.pathname === '/api/demo/project'     && req.method === 'GET') { await getDemoProjectHandler(req, res); return; }
  if (url.pathname === '/api/demo/generations' && req.method === 'GET') { await getDemoGenerationsHandler(req, res); return; }
  if (url.pathname === '/api/demo/blueprint'   && req.method === 'GET') { await getDemoBlueprintHandler(req, res); return; }
  if (url.pathname === '/api/demo/reset'       && req.method === 'POST') {
    await runChain([authMiddleware, requireAdmin], resetDemoHandler); return;
  }

  // ── Phase 5: Authenticated routes ───────────────────────────────────────────

  // Onboarding
  if (url.pathname === '/api/me/onboarding' && req.method === 'GET') {
    await runChain([authMiddleware], getOnboarding); return;
  }
  if (url.pathname === '/api/me/onboarding/advance' && req.method === 'POST') {
    await runChain([authMiddleware], advanceStep); return;
  }
  if (url.pathname === '/api/me/onboarding/complete' && req.method === 'POST') {
    await runChain([authMiddleware], completeOnboarding); return;
  }
  if (url.pathname === '/api/me/onboarding/skip' && req.method === 'POST') {
    await runChain([authMiddleware], skipOnboarding); return;
  }

  // ── Phase 5: Admin routes ──────────────────────────────────────────────
  if (url.pathname === '/api/admin/launch' && req.method === 'GET') {
    await runChain([authMiddleware, requireAdmin], getLaunchSummaryHandler); return;
  }
  if (url.pathname === '/api/admin/onboarding' && req.method === 'GET') {
    await runChain([authMiddleware, requireAdmin], getOnboardingFunnelHandler); return;
  }
  if (url.pathname === '/api/admin/analytics' && req.method === 'GET') {
    req.query = Object.fromEntries(url.searchParams);
    await runChain([authMiddleware, requireAdmin], getAnalyticsSummaryHandler); return;
  }
  if (url.pathname === '/api/admin/waitlist' && req.method === 'GET') {
    req.query = Object.fromEntries(url.searchParams);
    await runChain([authMiddleware, requireAdmin], getAdminWaitlist); return;
  }
  if (url.pathname === '/api/admin/feedback' && req.method === 'GET') {
    req.query = Object.fromEntries(url.searchParams);
    await runChain([authMiddleware, requireAdmin], getAdminFeedback); return;
  }
  const feedbackStatusMatch = url.pathname.match(/^\/api\/admin\/feedback\/([^/]+)\/status$/);
  if (feedbackStatusMatch && req.method === 'PATCH') {
    req.body = await readBody(req).catch(() => ({}));
    req.params = { id: feedbackStatusMatch[1] };
    await runChain([authMiddleware, requireAdmin], updateFeedbackStatusHandler); return;
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
  console.log('[server] Phase 4:  GET  /api/plans');
  console.log('[server]           GET  /api/me/plan  POST /api/me/plan');
  console.log('[server]           GET  /api/me/usage  GET /api/me/usage/events');
  console.log('[server]           GET/POST /api/workspaces');
  console.log('[server]           GET/PATCH/DELETE /api/workspaces/:id');
  console.log('[server]           GET/POST /api/workspaces/:id/members');
  console.log('[server]           GET /api/admin/metrics');
  console.log('[server]           GET /api/admin/credits');
});
