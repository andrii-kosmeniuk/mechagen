'use strict';

/**
 * Demo Handler — Phase 5
 *
 * GET /api/demo/project      — demo project (public, no auth)
 * GET /api/demo/generations  — demo generations (public)
 * GET /api/demo/blueprint    — demo blueprint (public)
 * POST /api/demo/reset       — re-seed demo data (admin only)
 */

const { getDemoProject, getDemoGenerations, getDemoBlueprint, resetDemo } = require('../services/demoService');
const { track } = require('../services/analyticsService');

function getDemoProjectHandler(req, res) {
  const project = getDemoProject();
  track({ sessionId: req.headers['x-session-id'] || null, eventName: 'demo_project_viewed' });
  return res.json({ project });
}

function getDemoGenerationsHandler(req, res) {
  return res.json({ generations: getDemoGenerations() });
}

function getDemoBlueprintHandler(req, res) {
  return res.json({ blueprint: getDemoBlueprint() });
}

function resetDemoHandler(req, res) {
  try {
    resetDemo();
    return res.json({ ok: true, message: 'Demo data reset' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getDemoProjectHandler, getDemoGenerationsHandler, getDemoBlueprintHandler, resetDemoHandler };
