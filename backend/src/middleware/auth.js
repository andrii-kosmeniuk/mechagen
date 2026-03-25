'use strict';

/**
 * Auth Middleware — Phase 4
 *
 * Reads `X-API-Key` or `Authorization: Bearer <token>` header,
 * maps it to a userId and attaches to req.user.
 *
 * In development mode (no API_KEY_REQUIRED env var set), all requests
 * are auto-authenticated as 'dev-user' — making this zero-friction for local dev.
 *
 * Production: set API_KEY_REQUIRED=true and configure keys in API_KEYS env var.
 * Format: API_KEYS=key1:userId1,key2:userId2
 *
 * Admin: set ADMIN_KEY=<key> — maps to admin userId with adminAccess plan.
 */

const { setUserPlan } = require('../services/subscriptionService');

// Parse configured API keys from env: "key1:userId1,key2:userId2"
function parseApiKeys() {
  const raw = process.env.API_KEYS || '';
  const map = new Map();
  for (const pair of raw.split(',')) {
    const [key, userId] = pair.split(':');
    if (key && userId) map.set(key.trim(), userId.trim());
  }
  // Admin key always present if configured
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey) {
    map.set(adminKey, 'admin-user');
    setUserPlan('admin-user', 'admin');
  }
  return map;
}

const API_KEY_MAP = parseApiKeys();
const KEY_REQUIRED = process.env.API_KEY_REQUIRED === 'true';

/**
 * Express middleware that sets req.user = { id, planCode }.
 * In development (KEY_REQUIRED=false), defaults to dev-user.
 */
function authMiddleware(req, res, next) {
  const apiKey =
    req.headers['x-api-key'] ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');

  if (apiKey) {
    const userId = API_KEY_MAP.get(apiKey);
    if (userId) {
      req.user = { id: userId };
      return next();
    }
    if (KEY_REQUIRED) {
      return res.status(401).json({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
    }
  }

  if (!KEY_REQUIRED) {
    // Dev mode: auto-auth as dev-user
    req.user = { id: process.env.DEV_USER_ID || 'dev-user' };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
}

/**
 * Middleware that requires admin plan access.
 */
function requireAdmin(req, res, next) {
  const { getUserPlan } = require('../services/subscriptionService');
  const plan = getUserPlan(req.user?.id);
  if (!plan?.features?.adminAccess) {
    return res.status(403).json({ error: 'Admin access required', code: 'NOT_ADMIN' });
  }
  next();
}

module.exports = { authMiddleware, requireAdmin };
