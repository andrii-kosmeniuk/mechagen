'use strict';

/**
 * Onboarding Service — Phase 5
 *
 * Per-user onboarding state machine.
 * Steps must be completed in order, but can be skipped.
 */

const { randomUUID } = require('crypto');

const STEPS = [
  'welcome',
  'choose_use_case',
  'explain_workflow',
  'first_project',
  'first_generation',
  'reach_result',
  'next_steps',
];

/** userId → onboarding record */
const onboardingStore = new Map();

function _now() { return new Date().toISOString(); }

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create a fresh onboarding state for a user (idempotent).
 */
function createOnboarding(userId) {
  if (onboardingStore.has(userId)) return onboardingStore.get(userId);
  const record = {
    id:          randomUUID(),
    userId,
    startedAt:   _now(),
    completedAt: null,
    currentStep: STEPS[0],
    stepIndex:   0,
    stepsCompleted: [],
    skipped:     false,
    updatedAt:   _now(),
  };
  onboardingStore.set(userId, record);
  return record;
}

/**
 * Get onboarding state for a user (creates if missing).
 */
function getOnboarding(userId) {
  return onboardingStore.get(userId) || createOnboarding(userId);
}

/**
 * Advance to the next step.
 * Returns the updated record.
 */
function advanceStep(userId) {
  const record = getOnboarding(userId);
  if (record.completedAt) return record; // already done

  if (!record.stepsCompleted.includes(record.currentStep)) {
    record.stepsCompleted.push(record.currentStep);
  }

  const nextIndex = record.stepIndex + 1;
  if (nextIndex >= STEPS.length) {
    return completeOnboarding(userId);
  }

  record.stepIndex   = nextIndex;
  record.currentStep = STEPS[nextIndex];
  record.updatedAt   = _now();
  return record;
}

/**
 * Mark onboarding as complete immediately (skip remaining steps).
 */
function completeOnboarding(userId) {
  const record = getOnboarding(userId);
  record.completedAt  = record.completedAt || _now();
  record.currentStep  = 'done';
  record.stepIndex    = STEPS.length;
  record.updatedAt    = _now();
  return record;
}

/**
 * Skip onboarding entirely.
 */
function skipOnboarding(userId) {
  const record = getOnboarding(userId);
  record.skipped      = true;
  record.completedAt  = record.completedAt || _now();
  record.currentStep  = 'done';
  record.updatedAt    = _now();
  return record;
}

/**
 * Check if a user has completed onboarding.
 */
function hasCompletedOnboarding(userId) {
  const record = onboardingStore.get(userId);
  return !!record?.completedAt;
}

// ─── Funnel metrics ───────────────────────────────────────────────────────────

/**
 * Get onboarding funnel metrics (admin use).
 */
function getOnboardingFunnelMetrics() {
  const all = Array.from(onboardingStore.values());
  const started   = all.length;
  const completed = all.filter(r => !!r.completedAt).length;
  const skipped   = all.filter(r => r.skipped).length;

  // Step dropoffs
  const stepCounts = {};
  for (const step of STEPS) stepCounts[step] = 0;
  for (const record of all) {
    for (const step of record.stepsCompleted) {
      if (stepCounts[step] !== undefined) stepCounts[step]++;
    }
  }

  return {
    started,
    completed,
    skipped,
    completionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
    stepReachCounts: stepCounts,
    steps: STEPS,
  };
}

/**
 * List all onboarding records (admin).
 */
function listAllOnboarding() {
  return Array.from(onboardingStore.values());
}

module.exports = {
  STEPS,
  createOnboarding,
  getOnboarding,
  advanceStep,
  completeOnboarding,
  skipOnboarding,
  hasCompletedOnboarding,
  getOnboardingFunnelMetrics,
  listAllOnboarding,
};
