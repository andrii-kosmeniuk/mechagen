'use strict';

/**
 * Request Validation Middleware — MechaGen
 *
 * Lightweight body/query/param validators for route handlers.
 * No external dependencies — use before calling service layer.
 *
 * Usage:
 *   const { requireBodyFields, requireQueryFields } = require('../middleware/validate');
 *   // In a handler:
 *   const err = requireBodyFields(req.body, ['email', 'message']);
 *   if (err) return res.status(400).json(err);
 */

// ── Body field validators ──────────────────────────────────────────────────────

/**
 * Require specific fields to be present and non-empty in req.body.
 * @param {object} body
 * @param {string[]} fields
 * @returns {object|null} Error shape or null if valid
 */
function requireBodyFields(body, fields) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body is required', code: 'BAD_REQUEST' };
  }
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return { error: `Missing required field: ${field}`, code: 'BAD_REQUEST', details: { field } };
    }
  }
  return null;
}

/**
 * Require specific fields in req.query.
 */
function requireQueryFields(query, fields) {
  if (!query || typeof query !== 'object') {
    return { error: 'Query parameters required', code: 'BAD_REQUEST' };
  }
  for (const field of fields) {
    if (!query[field]) {
      return { error: `Missing required query param: ${field}`, code: 'BAD_REQUEST', details: { field } };
    }
  }
  return null;
}

/**
 * Validate a field against an enum of allowed values.
 * @param {string} value
 * @param {string[]} allowed
 * @param {string} fieldName
 * @returns {object|null}
 */
function requireEnum(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    return {
      error: `Invalid value for ${fieldName}: "${value}"`,
      code:  'BAD_REQUEST',
      details: { field: fieldName, allowed },
    };
  }
  return null;
}

/**
 * Validate an email address format.
 * @param {string} email
 * @returns {object|null}
 */
function requireValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return { error: 'Email is required', code: 'MISSING_EMAIL' };
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) {
    return { error: 'Invalid email address', code: 'INVALID_EMAIL' };
  }
  return null;
}

/**
 * Validate a string field has a minimum length.
 * @param {string} value
 * @param {number} min
 * @param {string} fieldName
 * @returns {object|null}
 */
function requireMinLength(value, min, fieldName) {
  if (!value || value.trim().length < min) {
    return {
      error:   `${fieldName} must be at least ${min} characters`,
      code:    'BAD_REQUEST',
      details: { field: fieldName, minLength: min },
    };
  }
  return null;
}

/**
 * Validate a positive integer within an optional range.
 */
function requirePositiveInt(value, fieldName, max) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) return { error: `${fieldName} must be a positive integer`, code: 'BAD_REQUEST' };
  if (max !== undefined && n > max) return { error: `${fieldName} must not exceed ${max}`, code: 'BAD_REQUEST' };
  return null;
}

module.exports = {
  requireBodyFields,
  requireQueryFields,
  requireEnum,
  requireValidEmail,
  requireMinLength,
  requirePositiveInt,
};
