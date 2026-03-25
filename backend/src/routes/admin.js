'use strict';

/**
 * Admin Routes (Phase 4 + Phase 5)
 * GET  /api/admin/metrics
 * GET  /api/admin/credits
 * GET  /api/admin/subscriptions
 * POST /api/admin/users/:userId/plan
 * POST /api/admin/users/:userId/credits
 * GET  /api/admin/launch
 * GET  /api/admin/onboarding
 * GET  /api/admin/analytics
 * GET  /api/admin/waitlist
 * GET  /api/admin/feedback
 * PATCH /api/admin/feedback/:id/status
 */

const { getMetrics, getCredits, setUserPlanAdmin, addUserCredits, listSubscriptions } = require('../api/adminHandler');
const { getLaunchSummaryHandler, getOnboardingFunnelHandler, getAnalyticsSummaryHandler } = require('../api/launchAdminHandler');
const { getAdminWaitlist } = require('../api/waitlistHandler');
const { getAdminFeedback, updateFeedbackStatusHandler } = require('../api/feedbackHandler');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const ADMIN_CHAIN = [authMiddleware, requireAdmin];

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (!pathname.startsWith('/api/admin/')) return false;

  if (pathname === '/api/admin/metrics'       && method === 'GET') { await req._runChain(ADMIN_CHAIN, getMetrics);           return true; }
  if (pathname === '/api/admin/credits'        && method === 'GET') { await req._runChain(ADMIN_CHAIN, getCredits);           return true; }
  if (pathname === '/api/admin/subscriptions'  && method === 'GET') { await req._runChain(ADMIN_CHAIN, listSubscriptions);    return true; }
  if (pathname === '/api/admin/launch'         && method === 'GET') { await req._runChain(ADMIN_CHAIN, getLaunchSummaryHandler);   return true; }
  if (pathname === '/api/admin/onboarding'     && method === 'GET') { await req._runChain(ADMIN_CHAIN, getOnboardingFunnelHandler); return true; }
  if (pathname === '/api/admin/analytics'      && method === 'GET') { await req._runChain(ADMIN_CHAIN, getAnalyticsSummaryHandler); return true; }
  if (pathname === '/api/admin/waitlist'       && method === 'GET') { await req._runChain(ADMIN_CHAIN, getAdminWaitlist);     return true; }
  if (pathname === '/api/admin/feedback'       && method === 'GET') { await req._runChain(ADMIN_CHAIN, getAdminFeedback);     return true; }

  const adminPlanMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/plan$/);
  if (adminPlanMatch && method === 'POST') {
    req.body = await req._readBody().catch(() => ({}));
    req.params = { userId: adminPlanMatch[1] };
    await req._runChain(ADMIN_CHAIN, setUserPlanAdmin);
    return true;
  }

  const adminCreditsMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/credits$/);
  if (adminCreditsMatch && method === 'POST') {
    req.body = await req._readBody().catch(() => ({}));
    req.params = { userId: adminCreditsMatch[1] };
    await req._runChain(ADMIN_CHAIN, addUserCredits);
    return true;
  }

  const feedbackStatusMatch = pathname.match(/^\/api\/admin\/feedback\/([^/]+)\/status$/);
  if (feedbackStatusMatch && method === 'PATCH') {
    req.body = await req._readBody().catch(() => ({}));
    req.params = { id: feedbackStatusMatch[1] };
    await req._runChain(ADMIN_CHAIN, updateFeedbackStatusHandler);
    return true;
  }

  return false;
}

module.exports = { handle };
