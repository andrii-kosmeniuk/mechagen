'use strict';

/**
 * Analytics Routes
 * POST /api/analytics/track   (public)
 * GET  /api/analytics/summary (admin)
 * GET  /api/analytics/recent  (admin)
 */

const { trackEvent, getSummary, getRecent } = require('../api/analyticsHandler');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/analytics/track' && method === 'POST') {
    req.body = await req._readBody().catch(() => ({}));
    await trackEvent(req, res);
    return true;
  }

  if (pathname === '/api/analytics/summary' && method === 'GET') {
    await req._runChain([authMiddleware, requireAdmin], getSummary);
    return true;
  }

  if (pathname === '/api/analytics/recent' && method === 'GET') {
    await req._runChain([authMiddleware, requireAdmin], getRecent);
    return true;
  }

  return false;
}

module.exports = { handle };
