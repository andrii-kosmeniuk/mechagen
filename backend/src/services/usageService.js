'use strict';

/**
 * Usage Service — Phase 4
 *
 * Records billable usage events per user per calendar month.
 * Provides aggregation for quota enforcement and dashboard display.
 *
 * Event types:
 *   generation | blueprint_upload | blueprint_analysis |
 *   solid_build | export_obj | export_glb | export_stl
 */

const { randomUUID } = require('crypto');

/** Array of all usage event records (audit log) */
const usageEvents = [];

/** userId:YYYY-MM → { eventType: count } (aggregated cache) */
const usageCache = new Map();

function _monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function _cacheKey(userId, monthKey) {
  return `${userId}:${monthKey}`;
}

/**
 * Record a usage event.
 */
function recordUsageEvent({ userId, workspaceId = null, projectId = null, generationId = null, eventType, quantity = 1, metadata = {} }) {
  if (!userId || !eventType) throw new Error('recordUsageEvent: userId and eventType are required');

  const now  = new Date();
  const month = _monthKey(now);

  const event = {
    id:           randomUUID(),
    userId,
    workspaceId,
    projectId,
    generationId,
    eventType,
    quantity,
    month,
    metadata,
    createdAt:    now.toISOString(),
  };

  usageEvents.push(event);

  // Update aggregated cache
  const key = _cacheKey(userId, month);
  if (!usageCache.has(key)) usageCache.set(key, {});
  const agg = usageCache.get(key);
  agg[eventType] = (agg[eventType] || 0) + quantity;

  return event;
}

/**
 * Get aggregated usage for a user for the current month.
 */
function getUserUsageThisMonth(userId) {
  const key = _cacheKey(userId, _monthKey());
  const agg = usageCache.get(key) || {};
  return {
    generation:          agg['generation']          || 0,
    blueprint_upload:    agg['blueprint_upload']    || 0,
    blueprint_analysis:  agg['blueprint_analysis']  || 0,
    solid_build:         agg['solid_build']         || 0,
    export_obj:          agg['export_obj']          || 0,
    export_glb:          agg['export_glb']          || 0,
    export_stl:          agg['export_stl']          || 0,
    totalExports:        (agg['export_obj'] || 0) + (agg['export_glb'] || 0) + (agg['export_stl'] || 0),
    month:               _monthKey(),
  };
}

/**
 * Get usage for a specific month (YYYY-MM).
 */
function getUserUsageForMonth(userId, month) {
  const key = _cacheKey(userId, month);
  return usageCache.get(key) || {};
}

/**
 * Get all usage events for a user (audit log, paginated).
 */
function getUserUsageEvents(userId, { limit = 50, offset = 0 } = {}) {
  const events = usageEvents
    .filter(e => e.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(offset, offset + limit);
  return events;
}

/**
 * Get total system usage for the current month (admin use).
 */
function getSystemUsageThisMonth() {
  const month = _monthKey();
  const totals = {};
  const userSet = new Set();

  for (const event of usageEvents) {
    if (event.month !== month) continue;
    userSet.add(event.userId);
    totals[event.eventType] = (totals[event.eventType] || 0) + event.quantity;
  }

  return { month, activeUsers: userSet.size, totals };
}

/**
 * Check whether a user has exceeded their monthly quota for a given action.
 *
 * @param {string} userId
 * @param {string} eventType  e.g. 'generation'
 * @param {number} limit      from planService
 * @returns {{ allowed: boolean, used: number, limit: number, remaining: number }}
 */
function checkQuota(userId, eventType, limit) {
  const usage = getUserUsageThisMonth(userId);
  const used  = usage[eventType] || 0;
  // For export, special-case totalExports
  const effectiveUsed = eventType.startsWith('export') ? Math.max(used, usage.totalExports || 0) : used;
  const effectiveLimit = limit === Infinity ? Infinity : limit;
  const remaining = Math.max(0, effectiveLimit - effectiveUsed);
  return {
    allowed:   effectiveUsed < effectiveLimit,
    used:      effectiveUsed,
    limit:     effectiveLimit,
    remaining,
  };
}

module.exports = {
  recordUsageEvent,
  getUserUsageThisMonth,
  getUserUsageForMonth,
  getUserUsageEvents,
  getSystemUsageThisMonth,
  checkQuota,
};
