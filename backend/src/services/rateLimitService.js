'use strict';

/**
 * Rate Limit Service — Phase 4
 *
 * Sliding window in-memory rate limiter.
 * Key is typically `{userId}:{limitClass}` or `{ip}:{limitClass}`.
 * All limits are configurable via environment variables.
 */

/** limitClass → { requests, windowMs } */
const RATE_LIMIT_CONFIG = {
  generation:    { requests: parseInt(process.env.RL_GENERATION   || '5',  10), windowMs: parseInt(process.env.RL_WINDOW_MS || '60000', 10) },
  blueprint:     { requests: parseInt(process.env.RL_BLUEPRINT    || '10', 10), windowMs: parseInt(process.env.RL_WINDOW_MS || '60000', 10) },
  solid_build:   { requests: parseInt(process.env.RL_SOLID_BUILD  || '3',  10), windowMs: parseInt(process.env.RL_WINDOW_MS || '60000', 10) },
  export:        { requests: parseInt(process.env.RL_EXPORT       || '20', 10), windowMs: parseInt(process.env.RL_WINDOW_MS || '60000', 10) },
  admin:         { requests: parseInt(process.env.RL_ADMIN        || '30', 10), windowMs: parseInt(process.env.RL_WINDOW_MS || '60000', 10) },
  general:       { requests: parseInt(process.env.RL_GENERAL      || '60', 10), windowMs: parseInt(process.env.RL_WINDOW_MS || '60000', 10) },
};

/** key → timestamps[] */
const windowStore = new Map();

/**
 * Check + record a request against the rate limit.
 * Returns allow decision, current count, and retry-after if blocked.
 *
 * @param {string} key          e.g. 'user123:generation'
 * @param {string} limitClass   e.g. 'generation'
 * @returns {{ allowed: boolean, current: number, limit: number, retryAfterMs: number }}
 */
function checkRateLimit(key, limitClass = 'general') {
  const config = RATE_LIMIT_CONFIG[limitClass] || RATE_LIMIT_CONFIG['general'];
  const { requests: limit, windowMs } = config;
  const now = Date.now();
  const cutoff = now - windowMs;

  if (!windowStore.has(key)) windowStore.set(key, []);
  const timestamps = windowStore.get(key);

  // Evict expired entries
  const fresh = timestamps.filter(t => t > cutoff);
  windowStore.set(key, fresh);

  if (fresh.length >= limit) {
    const oldest = fresh[0];
    const retryAfterMs = oldest + windowMs - now;
    return { allowed: false, current: fresh.length, limit, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  fresh.push(now);
  return { allowed: true, current: fresh.length, limit, retryAfterMs: 0 };
}

/**
 * Reset rate limit for a key (admin / test use).
 */
function resetRateLimit(key) {
  windowStore.delete(key);
}

/**
 * Get current window state for a key (monitoring use).
 */
function getRateLimitStatus(key, limitClass = 'general') {
  const config = RATE_LIMIT_CONFIG[limitClass] || RATE_LIMIT_CONFIG['general'];
  const { requests: limit, windowMs } = config;
  const now    = Date.now();
  const cutoff = now - windowMs;
  const fresh  = (windowStore.get(key) || []).filter(t => t > cutoff);
  return { current: fresh.length, limit, windowMs, remaining: Math.max(0, limit - fresh.length) };
}

module.exports = {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  RATE_LIMIT_CONFIG,
};
