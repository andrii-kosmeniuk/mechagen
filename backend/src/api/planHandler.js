'use strict';

/**
 * Plan Handler — Phase 4
 *
 * GET  /api/plans         — list all plan definitions (public)
 * GET  /api/me/plan       — get current user's plan + subscription (auth)
 * POST /api/me/plan       — upgrade/set plan (dev/admin only)
 */

const { getAllPlans, getPlanDefinition } = require('../services/planService');
const { getUserSubscription, setUserPlan } = require('../services/subscriptionService');

function listPlans(req, res) {
  return res.json({ plans: getAllPlans() });
}

function getMyPlan(req, res) {
  const userId = req.user.id;
  const sub    = getUserSubscription(userId);
  const plan   = getPlanDefinition(sub.planCode);
  return res.json({ subscription: sub, plan });
}

function setMyPlan(req, res) {
  const userId   = req.user.id;
  const { planCode } = req.body;
  if (!planCode) return res.status(400).json({ error: 'planCode is required', code: 'MISSING_PLAN_CODE' });
  try {
    setUserPlan(userId, planCode);
    const sub  = getUserSubscription(userId);
    const plan = getPlanDefinition(sub.planCode);
    return res.json({ subscription: sub, plan });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message, code: 'INVALID_PLAN' });
  }
}

module.exports = { listPlans, getMyPlan, setMyPlan };
