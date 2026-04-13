'use strict';

/**
 * Plan Routes
 * GET  /api/plans
 * GET  /api/me/plan
 * POST /api/me/plan
 */

const { listPlans, getMyPlan, setMyPlan } = require('../api/planHandler');
const { authMiddleware } = require('../middleware/auth');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/plans' && method === 'GET') {
    await listPlans(req, res);
    return true;
  }

  if (pathname === '/api/me/plan' && method === 'GET') {
    await req._runChain([authMiddleware], getMyPlan);
    return true;
  }

  if (pathname === '/api/me/plan' && method === 'POST') {
    req.body = await req._readBody().catch(() => ({}));
    await req._runChain([authMiddleware], setMyPlan);
    return true;
  }

  return false;
}

module.exports = { handle };
