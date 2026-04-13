'use strict';

/**
 * Rate Limiter Middleware — Phase 4
 *
 * Returns an Express middleware factory that uses rateLimitService
 * to enforce per-user sliding window rate limits.
 *
 * Usage:
 *   router.post('/generate', rateLimitMiddleware('generation'), handler)
 */

const { checkRateLimit } = require('../services/rateLimitService');

/**
 * Create a rate-limit middleware for a given limit class.
 * Key: userId (from req.user.id) or IP fallback.
 *
 * @param {string} limitClass  e.g. 'generation' | 'blueprint' | 'solid_build' | 'export' | 'general'
 */
function rateLimitMiddleware(limitClass = 'general') {
  return function rateLimiter(req, res, next) {
    const userId = req.user?.id || req.ip || 'anonymous';
    const key    = `${userId}:${limitClass}`;

    const result = checkRateLimit(key, limitClass);

    // Always set rate limit headers
    res.set('X-RateLimit-Limit',     String(result.limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, result.limit - result.current)));

    if (!result.allowed) {
      res.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(429).json({
        error:  'Rate limit exceeded. Please slow down.',
        code:   'RATE_LIMITED',
        limitClass,
        retryAfterMs: result.retryAfterMs,
        retryAfterSec: Math.ceil(result.retryAfterMs / 1000),
      });
    }

    next();
  };
}

module.exports = { rateLimitMiddleware };
