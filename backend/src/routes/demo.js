'use strict';

/**
 * Demo Routes (public)
 * GET  /api/demo/project
 * GET  /api/demo/generations
 * GET  /api/demo/blueprint
 * POST /api/demo/reset  (admin)
 */

const { getDemoProjectHandler, getDemoGenerationsHandler, getDemoBlueprintHandler, resetDemoHandler } = require('../api/demoHandler');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/demo/project'     && method === 'GET') { await getDemoProjectHandler(req, res);     return true; }
  if (pathname === '/api/demo/generations' && method === 'GET') { await getDemoGenerationsHandler(req, res); return true; }
  if (pathname === '/api/demo/blueprint'   && method === 'GET') { await getDemoBlueprintHandler(req, res);   return true; }
  if (pathname === '/api/demo/reset'       && method === 'POST') {
    await req._runChain([authMiddleware, requireAdmin], resetDemoHandler);
    return true;
  }

  return false;
}

module.exports = { handle };
