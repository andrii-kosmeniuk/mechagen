'use strict';

/**
 * Admin Service — Phase 4
 *
 * Aggregates system-wide metrics for ops/admin visibility.
 */

const { listGenerations } = require('./orchestration');
const { getSystemUsageThisMonth } = require('./usageService');
const { listAllSubscriptions } = require('./subscriptionService');
const { listAllWorkspaces, getMembers } = require('./workspaceService');
const { getCreditSummary } = require('./creditService');
const { getSolidBuildStore } = require('./solidBuildService');
const { PLAN_DEFINITIONS } = require('./planService');

/**
 * Get full system metrics snapshot.
 */
function getSystemMetrics() {
  const generations = listGenerations();
  const now = new Date().toISOString();

  // Generation stats
  const totalGenerations  = generations.length;
  const readyGenerations  = generations.filter(g => g.status === 'ready').length;
  const failedGenerations = generations.filter(g => g.status === 'failed').length;
  const activeGenerations = generations.filter(g => !['ready', 'failed'].includes(g.status)).length;

  // Solid build stats
  let solidStore;
  try { solidStore = getSolidBuildStore(); } catch { solidStore = []; }
  const totalSolidBuilds  = solidStore.length;
  const readySolidBuilds  = solidStore.filter(b => b.status === 'solid_ready').length;
  const failedSolidBuilds = solidStore.filter(b => b.status === 'solid_failed').length;

  // Subscription / plan distribution
  const subscriptions = listAllSubscriptions();
  const planDistribution = {};
  for (const code of Object.keys(PLAN_DEFINITIONS)) planDistribution[code] = 0;
  for (const sub of subscriptions) {
    if (planDistribution[sub.planCode] !== undefined) planDistribution[sub.planCode]++;
    else planDistribution[sub.planCode] = 1;
  }

  // Workspace stats
  const workspaces = listAllWorkspaces();
  const totalWorkspaces = workspaces.length;
  const totalMembers = workspaces.reduce((sum, ws) => {
    try { return sum + getMembers(ws.id).length; } catch { return sum; }
  }, 0);

  // Usage this month
  const systemUsage = getSystemUsageThisMonth();

  // Credit summary
  const credits = getCreditSummary();
  const totalCreditsRemaining = credits.reduce((s, c) => s + c.balance, 0);

  // Failed job summaries
  const failedJobs = generations
    .filter(g => g.status === 'failed')
    .slice(-20)
    .map(g => ({
      id:           g.id,
      prompt:       (g.prompt || '').slice(0, 60),
      errorContext: (g.errorContext || '').slice(0, 200),
      createdAt:    g.createdAt,
    }));

  return {
    timestamp: now,
    generations: {
      total:   totalGenerations,
      ready:   readyGenerations,
      failed:  failedGenerations,
      active:  activeGenerations,
    },
    solidBuilds: {
      total:  totalSolidBuilds,
      ready:  readySolidBuilds,
      failed: failedSolidBuilds,
    },
    workspaces: {
      total:        totalWorkspaces,
      totalMembers,
    },
    subscriptions: {
      total:            subscriptions.length,
      planDistribution,
    },
    usage: systemUsage,
    credits: {
      usersTracked:          credits.length,
      totalCreditsRemaining,
    },
    failedJobs,
  };
}

module.exports = { getSystemMetrics };
