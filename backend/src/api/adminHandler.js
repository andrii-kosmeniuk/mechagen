'use strict';

/**
 * Admin Handler — Phase 4
 *
 * GET /api/admin/metrics — system-wide metrics snapshot
 * GET /api/admin/credits — credit balances
 * POST /api/admin/plans/:userId — set user plan (admin only)
 */

const { getSystemMetrics } = require('../services/adminService');
const { getCreditSummary, addCredits } = require('../services/creditService');
const { setUserPlan, listAllSubscriptions } = require('../services/subscriptionService');

function getMetrics(req, res) {
  try {
    const metrics = getSystemMetrics();
    return res.json({ metrics });
  } catch (err) {
    console.error('[admin] getMetrics error:', err.message);
    return res.status(500).json({ error: 'Failed to aggregate metrics', details: err.message });
  }
}

function getCredits(req, res) {
  return res.json({ credits: getCreditSummary() });
}

function setUserPlanAdmin(req, res) {
  const { userId } = req.params;
  const { planCode } = req.body;
  if (!planCode) return res.status(400).json({ error: 'planCode required', code: 'MISSING_PLAN' });
  try {
    setUserPlan(userId, planCode);
    return res.json({ success: true, userId, planCode });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

function addUserCredits(req, res) {
  const { userId } = req.params;
  const { amount } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'amount must be a number', code: 'INVALID_AMOUNT' });
  const balance = addCredits(userId, parseInt(amount, 10));
  return res.json({ success: true, userId, ...balance });
}

function listSubscriptions(req, res) {
  return res.json({ subscriptions: listAllSubscriptions() });
}

module.exports = { getMetrics, getCredits, setUserPlanAdmin, addUserCredits, listSubscriptions };
