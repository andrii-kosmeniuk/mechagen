'use strict';

/**
 * Usage Handler — Phase 4
 *
 * GET /api/me/usage              — get this month's usage for current user
 * GET /api/me/usage/events       — get usage event audit log
 * GET /api/workspaces/:id/usage  — get workspace usage (admin/owner only)
 */

const { getUserUsageThisMonth, getUserUsageEvents } = require('../services/usageService');
const { getUserPlanCode }  = require('../services/subscriptionService');
const { getPlanDefinition } = require('../services/planService');
const { getCreditBalance }  = require('../services/creditService');
const { getWorkspace, requireRole } = require('../services/workspaceService');

function getMyUsage(req, res) {
  const userId   = req.user.id;
  const planCode = getUserPlanCode(userId);
  const plan     = getPlanDefinition(planCode);
  const usage    = getUserUsageThisMonth(userId);
  const credits  = getCreditBalance(userId);

  return res.json({
    userId,
    planCode,
    plan: {
      name:                    plan.name,
      monthlyGenerationLimit:  plan.monthlyGenerationLimit,
      monthlyBlueprintLimit:   plan.monthlyBlueprintLimit,
      monthlySolidBuildLimit:  plan.monthlySolidBuildLimit,
      monthlyExportLimit:      plan.monthlyExportLimit,
    },
    usage,
    credits: {
      balance:    credits.balance,
      maxBalance: credits.maxBalance,
      month:      credits.month,
    },
    quotas: {
      generation:  { used: usage.generation,         limit: plan.monthlyGenerationLimit },
      blueprint:   { used: usage.blueprint_upload,   limit: plan.monthlyBlueprintLimit },
      solid_build: { used: usage.solid_build,        limit: plan.monthlySolidBuildLimit },
      export:      { used: usage.totalExports,       limit: plan.monthlyExportLimit },
    },
  });
}

function getMyUsageEvents(req, res) {
  const userId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = parseInt(req.query.offset || '0', 10);
  const events = getUserUsageEvents(userId, { limit, offset });
  return res.json({ userId, events, limit, offset });
}

function getWorkspaceUsage(req, res) {
  const userId      = req.user.id;
  const workspaceId = req.params.id;
  const ws = getWorkspace(workspaceId);
  if (!ws) return res.status(404).json({ error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' });
  try { requireRole(workspaceId, userId, 'member'); } catch (err) {
    return res.status(err.status || 403).json({ error: err.message, code: err.code });
  }
  // Placeholder: aggregate usage for all workspace members
  return res.json({ workspaceId, message: 'Workspace usage aggregation available with persistent storage.' });
}

module.exports = { getMyUsage, getMyUsageEvents, getWorkspaceUsage };
