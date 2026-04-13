'use strict';

/**
 * Onboarding Routes
 * GET  /api/me/onboarding
 * POST /api/me/onboarding/advance
 * POST /api/me/onboarding/complete
 * POST /api/me/onboarding/skip
 */

const { getOnboarding, advanceStep, completeOnboarding, skipOnboarding } = require('../api/onboardingHandler');
const { authMiddleware } = require('../middleware/auth');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/me/onboarding'          && method === 'GET')  { await req._runChain([authMiddleware], getOnboarding);      return true; }
  if (pathname === '/api/me/onboarding/advance'  && method === 'POST') { await req._runChain([authMiddleware], advanceStep);        return true; }
  if (pathname === '/api/me/onboarding/complete' && method === 'POST') { await req._runChain([authMiddleware], completeOnboarding);  return true; }
  if (pathname === '/api/me/onboarding/skip'     && method === 'POST') { await req._runChain([authMiddleware], skipOnboarding);     return true; }

  return false;
}

module.exports = { handle };
