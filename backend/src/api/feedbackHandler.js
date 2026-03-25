'use strict';

/**
 * Feedback Handler — Phase 5
 *
 * POST /api/feedback              — submit feedback (public, auth optional)
 * GET  /api/admin/feedback        — admin: list feedback
 * PATCH /api/admin/feedback/:id   — admin: update status
 */

const { submitFeedback, getFeedback, updateFeedbackStatus, getFeedbackSummary, VALID_CATEGORIES } = require('../services/feedbackService');
const { track } = require('../services/analyticsService');

function submitFeedbackHandler(req, res) {
  const { category, message, projectId, generationId, metadata } = req.body || {};
  const userId = req.user?.id || null; // auth is optional for feedback

  try {
    const entry = submitFeedback({ userId, projectId, generationId, category, message, metadata });
    track({ userId, eventName: 'feedback_submit', metadata: { category } });
    return res.status(201).json({ ok: true, feedbackId: entry.id, message: 'Thank you for your feedback!' });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code, validCategories: VALID_CATEGORIES });
  }
}

function getAdminFeedback(req, res) {
  const category = req.query?.category || null;
  const status   = req.query?.status || null;
  const limit    = Math.min(parseInt(req.query?.limit || '50', 10), 200);
  const offset   = parseInt(req.query?.offset || '0', 10);
  const result   = getFeedback({ category, status, limit, offset });
  return res.json({ ...result, summary: getFeedbackSummary() });
}

function updateFeedbackStatusHandler(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};
  try {
    const entry = updateFeedbackStatus(id, status);
    return res.json({ ok: true, feedback: entry });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

module.exports = { submitFeedbackHandler, getAdminFeedback, updateFeedbackStatusHandler };
