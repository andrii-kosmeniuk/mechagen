'use strict';

/**
 * Usage Routes
 * GET /api/me/usage
 * GET /api/me/usage/events
 */

const { getMyUsage, getMyUsageEvents } = require('../api/usageHandler');
const { authMiddleware } = require('../middleware/auth');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/me/usage' && method === 'GET') {
    await req._runChain([authMiddleware], getMyUsage);
    return true;
  }

  if (pathname === '/api/me/usage/events' && method === 'GET') {
    await req._runChain([authMiddleware], getMyUsageEvents);
    return true;
  }

  return false;
}

module.exports = { handle };
