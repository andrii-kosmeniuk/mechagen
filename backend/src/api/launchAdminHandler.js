'use strict';

/**
 * Launch Admin Handler — Phase 5
 *
 * GET  /api/admin/launch       — full launch summary
 * GET  /api/admin/waitlist     — waitlist entries
 * GET  /api/admin/feedback     — see feedbackHandler
 * GET  /api/admin/onboarding   — onboarding funnel
 * GET  /api/admin/analytics    — analytics summary
 */

const { getLaunchSummary }            = require('../services/launchAdminService');
const { getOnboardingFunnelMetrics, listAllOnboarding } = require('../services/onboardingService');
const { getAnalyticsSummary, getRecentEvents } = require('../services/analyticsService');

function getLaunchSummaryHandler(req, res) {
  try {
    return res.json(getLaunchSummary());
  } catch (err) {
    console.error('[launchAdmin] summary error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function getOnboardingFunnelHandler(req, res) {
  return res.json({
    funnel: getOnboardingFunnelMetrics(),
    users:  listAllOnboarding().slice(0, 50),
  });
}

function getAnalyticsSummaryHandler(req, res) {
  const limit = Math.min(parseInt(req.query?.limit || '20', 10), 100);
  return res.json({
    summary: getAnalyticsSummary(),
    recent:  getRecentEvents({ limit }),
  });
}

module.exports = { getLaunchSummaryHandler, getOnboardingFunnelHandler, getAnalyticsSummaryHandler };
