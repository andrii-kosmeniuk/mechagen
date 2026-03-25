'use strict';

/**
 * Feedback Service — Phase 5
 *
 * In-app feedback, bug reports, and feature requests.
 * Optional linkage to project/generation context.
 */

const { randomUUID } = require('crypto');

const VALID_CATEGORIES = [
  'bug',
  'feature_request',
  'usability',
  'generation_quality',
  'export_issue',
  'billing_issue',
  'other',
];

const VALID_STATUSES = ['open', 'in_review', 'resolved', 'wont_fix'];

/** id → feedback entry */
const feedbackStore = new Map();

/**
 * Submit a feedback entry.
 */
function submitFeedback({ userId = null, projectId = null, generationId = null, category, message, metadata = {} }) {
  if (!category || !VALID_CATEGORIES.includes(category)) {
    throw Object.assign(
      new Error(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`),
      { status: 400, code: 'INVALID_CATEGORY' }
    );
  }
  if (!message || message.trim().length < 3) {
    throw Object.assign(new Error('Message is required (min 3 chars)'), { status: 400, code: 'MISSING_MESSAGE' });
  }

  const entry = {
    id:           randomUUID(),
    userId,
    projectId,
    generationId,
    category,
    message:      message.trim().slice(0, 2000),
    metadata,
    status:       'open',
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
  };
  feedbackStore.set(entry.id, entry);
  return entry;
}

/**
 * Get feedback entries with optional filters.
 */
function getFeedback({ category = null, status = null, limit = 50, offset = 0 } = {}) {
  let entries = Array.from(feedbackStore.values());
  if (category) entries = entries.filter(e => e.category === category);
  if (status)   entries = entries.filter(e => e.status === status);
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { entries: entries.slice(offset, offset + limit), total: entries.length };
}

/**
 * Update feedback status (admin use).
 */
function updateFeedbackStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw Object.assign(new Error(`Invalid status. Must be: ${VALID_STATUSES.join(', ')}`), { status: 400 });
  }
  const entry = feedbackStore.get(id);
  if (!entry) throw Object.assign(new Error('Feedback not found'), { status: 404 });
  entry.status    = status;
  entry.updatedAt = new Date().toISOString();
  return entry;
}

/**
 * Get summary by category (admin).
 */
function getFeedbackSummary() {
  const byCategory = {};
  for (const cat of VALID_CATEGORIES) byCategory[cat] = 0;
  for (const e of feedbackStore.values()) {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }
  const openCount = Array.from(feedbackStore.values()).filter(e => e.status === 'open').length;
  return { total: feedbackStore.size, byCategory, openCount };
}

module.exports = {
  VALID_CATEGORIES,
  submitFeedback,
  getFeedback,
  updateFeedbackStatus,
  getFeedbackSummary,
};
