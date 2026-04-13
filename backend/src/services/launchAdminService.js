'use strict';

/**
 * Launch Admin Service — Phase 5
 *
 * Aggregates all launch-relevant metrics for ops/admin visibility.
 */

const { getAnalyticsSummary }         = require('./analyticsService');
const { getWaitlistCount, getWaitlist } = require('./waitlistService');
const { getFeedbackSummary, getFeedback } = require('./feedbackService');
const { getOnboardingFunnelMetrics }   = require('./onboardingService');
const { getDemoLoadCount }             = require('./demoService');
const { getSystemMetrics }             = require('./adminService');

function getLaunchSummary() {
  const analyticsSummary = getAnalyticsSummary();
  const { entries: recentWaitlist } = getWaitlist({ limit: 5 });
  const feedbackSummary  = getFeedbackSummary();
  const { entries: openFeedback }   = getFeedback({ status: 'open', limit: 5 });
  const onboarding       = getOnboardingFunnelMetrics();
  const demoLoads        = getDemoLoadCount();

  // Core system metrics (from Phase 4 adminService)
  let systemMetrics = null;
  try { systemMetrics = getSystemMetrics(); } catch { /* ignore */ }

  return {
    timestamp: new Date().toISOString(),
    analytics: analyticsSummary,
    waitlist: {
      total:        getWaitlistCount(),
      recentEntries: recentWaitlist,
    },
    feedback: {
      ...feedbackSummary,
      recentOpen: openFeedback,
    },
    onboarding,
    demo: {
      totalLoads: demoLoads,
    },
    system: systemMetrics
      ? {
          activeGenerations:  systemMetrics.generations.active,
          totalGenerations:   systemMetrics.generations.total,
          failedGenerations:  systemMetrics.generations.failed,
          planDistribution:   systemMetrics.subscriptions.planDistribution,
        }
      : null,
  };
}

module.exports = { getLaunchSummary };
