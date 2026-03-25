'use strict';

/**
 * src/app.js — Application Bootstrap
 *
 * Creates the HTTP server, provides shared utilities (readBody, makeRes, runChain),
 * and mounts all route modules. server.js becomes a thin entrypoint.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

// ── Shared HTTP utilities ──────────────────────────────────────────────────────

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

function makeRes(rawRes) {
  const res = {
    _status: 200,
    _headers: {},
    status(code) { res._status = code; return res; },
    setHeader(k, v) { res._headers[k] = v; return res; },
    set(k, v)      { res._headers[k] = v; return res; },
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

/**
 * Run an Express-style middleware chain then the terminal handler.
 * @param {object} req
 * @param {object} res
 * @param {Function[]} middlewares
 * @param {Function} handler
 */
async function runChain(req, res, middlewares, handler) {
  let i = 0;
  const next = async (err) => {
    if (err) {
      res.status(err.status || 500).json({ error: err.message, code: err.code });
      return;
    }
    if (i < middlewares.length) {
      const mw = middlewares[i++];
      await mw(req, res, next);
    } else {
      await handler(req, res);
    }
  };
  await next();
}

// ── Route modules ──────────────────────────────────────────────────────────────

const publicRoutes      = require('./routes/public');
const generationRoutes  = require('./routes/generation');
const blueprintRoutes   = require('./routes/blueprint');
const exportRoutes      = require('./routes/export');
const solidBuildRoutes  = require('./routes/solidBuild');
const catalogRoutes     = require('./routes/catalog');
const planRoutes        = require('./routes/plan');
const usageRoutes       = require('./routes/usage');
const workspaceRoutes   = require('./routes/workspace');
const adminRoutes       = require('./routes/admin');
const onboardingRoutes  = require('./routes/onboarding');
const analyticsRoutes   = require('./routes/analytics');
const waitlistRoutes    = require('./routes/waitlist');
const feedbackRoutes    = require('./routes/feedback');
const demoRoutes        = require('./routes/demo');

const ALL_ROUTES = [
  publicRoutes,
  analyticsRoutes,   // public, before auth routes
  waitlistRoutes,
  demoRoutes,
  feedbackRoutes,    // auth-optional
  generationRoutes,
  blueprintRoutes,
  exportRoutes,
  solidBuildRoutes,
  catalogRoutes,
  planRoutes,
  usageRoutes,
  workspaceRoutes,
  onboardingRoutes,
  adminRoutes,
];

// ── Request context builder ────────────────────────────────────────────────────

function buildContext(rawReq, rawRes, PORT) {
  const url = new URL(rawReq.url, `http://localhost:${PORT}`);
  const res = makeRes(rawRes);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-API-Key,Authorization');

  // Attach helpers to req
  rawReq.url_parsed    = url;
  rawReq.pathname      = url.pathname;
  rawReq.query         = Object.fromEntries(url.searchParams);
  rawReq.params        = rawReq.params || {};
  rawReq._readBody     = () => readBody(rawReq);
  rawReq._runChain     = (mws, handler) => runChain(rawReq, res, mws, handler);

  return { req: rawReq, res, rawRes, url };
}

// ── App factory ────────────────────────────────────────────────────────────────

function createApp(PORT = 3001) {
  const server = http.createServer(async (rawReq, rawRes) => {
    const { req, res, rawRes: rr, url } = buildContext(rawReq, rawRes, PORT);

    if (rawReq.method === 'OPTIONS') {
      rr.writeHead(204, res._headers);
      rr.end();
      return;
    }

    // Try each route module
    for (const routeModule of ALL_ROUTES) {
      const handled = await routeModule.handle(req, res, rr, url);
      if (handled) return;
    }

    // 404 catch-all
    res.status(404).json({ error: `No route for ${rawReq.method} ${url.pathname}` });
  });

  server.on('error', (err) => {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.error(`[server] Cannot bind port ${PORT} — try: sudo node server.js`);
    } else if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${PORT} already in use`);
    } else {
      console.error('[server] Error:', err.message);
    }
    process.exit(1);
  });

  return { server, readBody, makeRes, runChain };
}

module.exports = { createApp, readBody, makeRes, runChain };
