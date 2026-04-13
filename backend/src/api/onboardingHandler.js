'use strict';

/**
 * Onboarding Handler — Phase 5
 *
 * GET  /api/me/onboarding         — get/init onboarding state
 * POST /api/me/onboarding/advance — advance to next step
 * POST /api/me/onboarding/complete — mark complete
 * POST /api/me/onboarding/skip    — skip onboarding
 */

const svc = require('../services/onboardingService');
const { track } = require('../services/analyticsService');

function getOnboarding(req, res) {
  const state = svc.getOnboarding(req.user.id);
  return res.json({ onboarding: state, steps: svc.STEPS });
}

function advanceStep(req, res) {
  const state = svc.advanceStep(req.user.id);
  // Track first_generation and onboarding_completed events
  if (state.currentStep === 'first_generation') {
    track({ userId: req.user.id, eventName: 'onboarding_first_generation_step' });
  }
  if (state.completedAt && !state.skipped) {
    track({ userId: req.user.id, eventName: 'onboarding_completed' });
  }
  return res.json({ onboarding: state });
}

function completeOnboarding(req, res) {
  const state = svc.completeOnboarding(req.user.id);
  track({ userId: req.user.id, eventName: 'onboarding_completed' });
  return res.json({ onboarding: state });
}

function skipOnboarding(req, res) {
  const state = svc.skipOnboarding(req.user.id);
  track({ userId: req.user.id, eventName: 'onboarding_skipped' });
  return res.json({ onboarding: state });
}

module.exports = { getOnboarding, advanceStep, completeOnboarding, skipOnboarding };
