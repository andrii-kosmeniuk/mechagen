'use strict';

/**
 * Analytics Service — Phase 5
 *
 * Provider-agnostic structured event ingestion.
 * Events are stored in-memory and optionally forwarded to PostHog or Segment
 * if the respective env key is set (fire-and-forget, non-blocking).
 *
 * Plug-in points:
 *   POSTHOG_API_KEY  → forwards to api.posthog.com
 *   SEGMENT_WRITE_KEY → forwards to api.segment.io
 */

const { randomUUID } = require('crypto');
const https = require('https');

/** All analytics events (audit store) */
const eventStore = [];

/** event_name → count (hot aggregation cache) */
const countCache = new Map();

// ─── Core track ───────────────────────────────────────────────────────────────

/**
 * Track an analytics event.
 *
 * @param {{ userId?, sessionId?, eventName, page?, metadata? }} opts
 * @returns {object} recorded event
 */
function track({ userId = null, sessionId = null, eventName, page = null, metadata = {} }) {
  if (!eventName) throw new Error('eventName is required');

  const event = {
    id:         randomUUID(),
    userId,
    sessionId,
    eventName,
    page,
    metadata,
    createdAt:  new Date().toISOString(),
  };

  eventStore.push(event);
  countCache.set(eventName, (countCache.get(eventName) || 0) + 1);

  // Non-blocking provider forward
  _forwardToProviders(event);

  return event;
}

// ─── Querying ─────────────────────────────────────────────────────────────────

function getAnalyticsSummary() {
  const totals = {};
  for (const [name, count] of countCache.entries()) totals[name] = count;

  const now   = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const last24h = eventStore.filter(e => (now - new Date(e.createdAt).getTime()) < dayMs);

  const last24hCounts = {};
  for (const e of last24h) {
    last24hCounts[e.eventName] = (last24hCounts[e.eventName] || 0) + 1;
  }

  return {
    totalEvents: eventStore.length,
    uniqueEventNames: countCache.size,
    totals,
    last24h: last24hCounts,
    last24hCount: last24h.length,
  };
}

function getEventsByName(eventName, { limit = 100 } = {}) {
  return eventStore
    .filter(e => e.eventName === eventName)
    .slice(-limit)
    .reverse();
}

function getRecentEvents({ limit = 50 } = {}) {
  return eventStore.slice(-limit).reverse();
}

// ─── Provider forwarding ──────────────────────────────────────────────────────

function _postJson(url, body, headers = {}) {
  return new Promise((resolve) => {
    try {
      const data = JSON.stringify(body);
      const parsed = new URL(url);
      const req = https.request({
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
      }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', () => resolve(null));
      req.write(data);
      req.end();
    } catch { resolve(null); }
  });
}

function _forwardToProviders(event) {
  // PostHog
  const posthogKey = process.env.POSTHOG_API_KEY;
  if (posthogKey) {
    _postJson('https://app.posthog.com/capture/', {
      api_key:     posthogKey,
      event:       event.eventName,
      distinct_id: event.userId || event.sessionId || 'anonymous',
      properties:  { ...event.metadata, page: event.page, $lib: 'mechagen-server' },
      timestamp:   event.createdAt,
    }).catch(() => {});
  }

  // Segment
  const segmentKey = process.env.SEGMENT_WRITE_KEY;
  if (segmentKey) {
    const auth = Buffer.from(`${segmentKey}:`).toString('base64');
    _postJson('https://api.segment.io/v1/track', {
      userId:     event.userId || 'anonymous',
      event:      event.eventName,
      properties: { ...event.metadata, page: event.page },
      context:    { library: { name: 'mechagen-server', version: '5.0' } },
      timestamp:  event.createdAt,
    }, { Authorization: `Basic ${auth}` }).catch(() => {});
  }
}

module.exports = {
  track,
  getAnalyticsSummary,
  getEventsByName,
  getRecentEvents,
};
