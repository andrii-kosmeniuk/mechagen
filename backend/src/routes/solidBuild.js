'use strict';

/**
 * Solid Build Routes
 * POST /api/generations/:id/solid/start
 * GET  /api/generations/:id/solid/status
 */

const { solidStartHandler, solidStatusHandler } = require('../api/solidBuildHandler');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  const solidStartMatch = pathname.match(/^\/api\/generations\/([^/]+)\/solid\/start$/);
  if (solidStartMatch && method === 'POST') {
    req.params = { id: solidStartMatch[1] };
    req.body   = req.body || await req._readBody().catch(() => ({}));
    await solidStartHandler(req, res);
    return true;
  }

  const solidStatusMatch = pathname.match(/^\/api\/generations\/([^/]+)\/solid\/status$/);
  if (solidStatusMatch && method === 'GET') {
    req.params = { id: solidStatusMatch[1] };
    await solidStatusHandler(req, res);
    return true;
  }

  return false;
}

module.exports = { handle };
