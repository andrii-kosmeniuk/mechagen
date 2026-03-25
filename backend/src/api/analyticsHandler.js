'use strict';

/**
 * Analytics Handler — Phase 5
 *
 * POST /api/analytics/track  — ingest an event (public, no auth required)
 */

const { track, getAnalyticsSummary, getRecentEvents, getEventsByName } = require('../services/analyticsService');

// Simple rate limit: max 30 events per IP per minute
const ipEventCount = new Map();
setInterval(() => ipEventCount.clear(), 60_000);

const ALLOWED_EVENTS = new Set([
  'landing_visit','cta_click','waitlist_view','waitlist_submit',
  'pricing_view','signup_start','signup_complete',
  'onboarding_started','onboarding_completed','onboarding_skipped',
  'first_project_created','first_generation_requested','first_generation_succeeded',
  'blueprint_upload_used','repair_used','export_used','solid_used',
  'feedback_submit','demo_started','demo_project_viewed',
]);

function trackEvent(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  const count = (ipEventCount.get(ip) || 0) + 1;
  ipEventCount.set(ip, count);
  if (count > 30) {
    return res.status(429).json({ error: 'Too many events', code: 'RATE_LIMITED' });
  }

  const { userId, sessionId, eventName, page, metadata } = req.body || {};
  if (!eventName) return res.status(400).json({ error: 'eventName is required', code: 'MISSING_EVENT_NAME' });
  if (!ALLOWED_EVENTS.has(eventName)) {
    return res.status(400).json({ error: `Unknown event: ${eventName}`, code: 'UNKNOWN_EVENT', allowed: [...ALLOWED_EVENTS] });
  }

  try {
    const event = track({ userId, sessionId, eventName, page, metadata });
    return res.status(201).json({ ok: true, eventId: event.id });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// Admin only
function getSummary(req, res) {
  return res.json(getAnalyticsSummary());
}

function getRecent(req, res) {
  const limit = Math.min(parseInt(req.query?.limit || '50', 10), 200);
  return res.json({ events: getRecentEvents({ limit }) });
}

function getByName(req, res) {
  const name  = req.params?.name;
  const limit = Math.min(parseInt(req.query?.limit || '50', 10), 200);
  return res.json({ events: getEventsByName(name, { limit }) });
}

module.exports = { trackEvent, getSummary, getRecent, getByName };
