'use strict';

/**
 * Subscription Service — Phase 4
 *
 * Maps users to their current plan.
 * In-memory store — Stripe-ready extension point.
 *
 * Stripe integration: when `STRIPE_SECRET_KEY` is set, webhook handler
 * at POST /api/webhooks/stripe will call setUserPlan() to sync.
 */

const { getPlanDefinition, DEFAULT_PLAN } = require('./planService');
const { randomUUID } = require('crypto');

/** userId → subscription record */
const subscriptionStore = new Map();

function _makeSubscription(userId, planCode) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return {
    id:                randomUUID(),
    userId,
    planCode,
    status:            'active',
    currentPeriodStart: periodStart,
    currentPeriodEnd:   periodEnd,
    stripePriceId:     null,
    stripeSubscriptionId: null,
    createdAt:         now.toISOString(),
    updatedAt:         now.toISOString(),
  };
}

/**
 * Get a user's current plan code.
 * Falls back to DEFAULT_PLAN if no subscription found.
 */
function getUserPlanCode(userId) {
  const sub = subscriptionStore.get(userId);
  return sub?.planCode || DEFAULT_PLAN;
}

/**
 * Get the full subscription record for a user.
 */
function getUserSubscription(userId) {
  const sub = subscriptionStore.get(userId);
  if (!sub) {
    // Auto-create free subscription for new users
    const newSub = _makeSubscription(userId, DEFAULT_PLAN);
    subscriptionStore.set(userId, newSub);
    return newSub;
  }
  return sub;
}

/**
 * Get the full plan definition for a user.
 */
function getUserPlan(userId) {
  const planCode = getUserPlanCode(userId);
  return getPlanDefinition(planCode);
}

/**
 * Set a user's plan (admin / seed / webhook use).
 */
function setUserPlan(userId, planCode) {
  const existing = subscriptionStore.get(userId);
  const plan = getPlanDefinition(planCode); // validate
  const now  = new Date().toISOString();
  if (existing) {
    subscriptionStore.set(userId, { ...existing, planCode: plan.code, updatedAt: now });
  } else {
    subscriptionStore.set(userId, _makeSubscription(userId, plan.code));
  }
}

/**
 * Stripe webhook handler stub.
 * Call this from your Stripe webhook route when events arrive.
 */
function handleStripeEvent(eventType, eventData) {
  if (eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.created') {
    const { metadata, status, items } = eventData.object || {};
    const userId = metadata?.userId;
    const priceId = items?.data?.[0]?.price?.id;
    if (userId && status === 'active') {
      // Map Stripe price ID to plan code — configure via env
      const planMap = JSON.parse(process.env.STRIPE_PLAN_MAP || '{}');
      const planCode = planMap[priceId] || DEFAULT_PLAN;
      setUserPlan(userId, planCode);
    }
  }
  if (eventType === 'customer.subscription.deleted') {
    const { metadata } = eventData.object || {};
    const userId = metadata?.userId;
    if (userId) setUserPlan(userId, DEFAULT_PLAN);
  }
}

/**
 * List all subscriptions (admin use).
 */
function listAllSubscriptions() {
  return Array.from(subscriptionStore.values());
}

module.exports = {
  getUserPlanCode,
  getUserSubscription,
  getUserPlan,
  setUserPlan,
  handleStripeEvent,
  listAllSubscriptions,
};
