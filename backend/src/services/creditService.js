'use strict';

/**
 * Credit Service — Phase 4
 *
 * Each user gets a monthly credit balance determined by their plan.
 * Expensive operations deduct credits. Rejected when balance is zero.
 *
 * Monthly reset happens on the first request after a new month starts.
 */

const { getUserPlan } = require('./subscriptionService');

/** userId → { balance: N, month: 'YYYY-MM', lastRefill: ISO } */
const creditStore = new Map();

/** Credit cost per operation type */
const CREDIT_COSTS = {
  generation:          2,
  blueprint_analysis:  3,
  solid_build:         8,
  export_obj:          1,
  export_glb:          1,
  export_stl:          2,
  blueprint_upload:    0,   // free — quota enforced separately
};

function _monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function _getOrInitBalance(userId) {
  const currentMonth = _monthKey();
  const record = creditStore.get(userId);

  if (!record || record.month !== currentMonth) {
    // New month or first access — refill from plan
    const plan    = getUserPlan(userId);
    const credits = plan.creditsPerMonth === Infinity ? 999999 : plan.creditsPerMonth;
    const newRecord = {
      userId,
      balance:    credits,
      maxBalance: credits,
      month:      currentMonth,
      lastRefill: new Date().toISOString(),
    };
    creditStore.set(userId, newRecord);
    return newRecord;
  }
  return record;
}

/**
 * Get current credit balance for a user.
 */
function getCreditBalance(userId) {
  return _getOrInitBalance(userId);
}

/**
 * Get the credit cost for an operation type.
 */
function getOperationCost(opType) {
  return CREDIT_COSTS[opType] ?? 1;
}

/**
 * Check if a user can afford an operation without deducting.
 *
 * @returns {{ allowed: boolean, remaining: number, cost: number, reason?: string }}
 */
function checkCredits(userId, opType) {
  const cost    = getOperationCost(opType);
  const record  = _getOrInitBalance(userId);
  const allowed = record.balance >= cost;
  return {
    allowed,
    remaining: record.balance,
    maxBalance: record.maxBalance,
    cost,
    month: record.month,
    reason: allowed ? null : `Insufficient credits: need ${cost}, have ${record.balance}. Credits reset monthly.`,
  };
}

/**
 * Deduct credits for an operation.
 * Returns the updated balance record.
 * Throws if insufficient credits (caller should check first).
 */
function deductCredits(userId, opType) {
  const cost   = getOperationCost(opType);
  const record = _getOrInitBalance(userId);
  if (record.balance < cost) {
    const err = new Error(`Insufficient credits: need ${cost}, have ${record.balance}`);
    err.status = 402;
    err.code   = 'INSUFFICIENT_CREDITS';
    throw err;
  }
  record.balance = Math.max(0, record.balance - cost);
  return { ...record };
}

/**
 * Add credits to a user's balance (admin / promo use).
 */
function addCredits(userId, amount) {
  const record = _getOrInitBalance(userId);
  record.balance = record.balance + amount;
  return { ...record };
}

/**
 * Force a monthly refill for a user (admin / reset use).
 */
function refillCredits(userId) {
  creditStore.delete(userId);
  return _getOrInitBalance(userId);
}

/**
 * Get system-wide credit summary (admin).
 */
function getCreditSummary() {
  return Array.from(creditStore.values()).map(r => ({
    userId:    r.userId,
    balance:   r.balance,
    maxBalance: r.maxBalance,
    month:     r.month,
  }));
}

module.exports = {
  getCreditBalance,
  getOperationCost,
  checkCredits,
  deductCredits,
  addCredits,
  refillCredits,
  getCreditSummary,
  CREDIT_COSTS,
};
