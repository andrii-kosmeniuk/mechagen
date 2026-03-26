'use strict';

/**
 * Shared API Response Helpers — MechaGen
 *
 * Provides consistent success and error response shapes.
 * All route handlers and controllers should use these helpers.
 *
 * Success shape:  { data, meta? }
 * Error shape:    { error, code, details? }
 */

// ── Success responses ──────────────────────────────────────────────────────────

/**
 * Send a 200 OK with a data payload.
 * @param {object} res
 * @param {unknown} data
 * @param {object}  [meta]  Optional metadata (pagination, counts, etc.)
 */
function ok(res, data, meta) {
  const body = { data };
  if (meta !== undefined) body.meta = meta;
  return res.status(200).json(body);
}

/**
 * Send a 201 Created.
 */
function created(res, data, meta) {
  const body = { data };
  if (meta !== undefined) body.meta = meta;
  return res.status(201).json(body);
}

/**
 * Send a 204 No Content.
 */
function noContent(res) {
  return res.status(204).end();
}

/**
 * Send an accepted (202) response with optional status info.
 */
function accepted(res, data) {
  return res.status(202).json({ data });
}

// ── Error responses ────────────────────────────────────────────────────────────

/**
 * Send a generic error response.
 * @param {object} res
 * @param {number} status   HTTP status
 * @param {string} message  Human-readable description
 * @param {string} code     Machine-readable code (SCREAMING_SNAKE)
 * @param {unknown} [details] Optional extra info
 */
function error(res, status, message, code = 'ERROR', details) {
  const body = { error: message, code };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}

function badRequest(res, message = 'Bad request', code = 'BAD_REQUEST', details) {
  return error(res, 400, message, code, details);
}

function unauthorized(res, message = 'Unauthorized', code = 'UNAUTHORIZED') {
  return error(res, 401, message, code);
}

function forbidden(res, message = 'Forbidden', code = 'FORBIDDEN') {
  return error(res, 403, message, code);
}

function notFound(res, resource = 'Resource', code = 'NOT_FOUND') {
  return error(res, 404, `${resource} not found`, code);
}

function conflict(res, message = 'Conflict', code = 'CONFLICT') {
  return error(res, 409, message, code);
}

function tooManyRequests(res, message = 'Too many requests', code = 'RATE_LIMITED') {
  return error(res, 429, message, code);
}

function paymentRequired(res, message = 'Quota exceeded', code = 'QUOTA_EXCEEDED') {
  return error(res, 402, message, code);
}

function internal(res, message = 'Internal server error', code = 'INTERNAL_ERROR') {
  return error(res, 500, message, code);
}

/**
 * Convert any error (AppError, plain Error, or shaped object) into a response.
 */
function fromError(res, err) {
  const status  = err?.status  || 500;
  const code    = err?.code    || 'INTERNAL_ERROR';
  const message = err?.message || 'Unknown error';
  if (status >= 500) console.error(`[error] ${code}: ${message}`, err?.meta || '');
  return error(res, status, message, code);
}

// ── Pagination helper ──────────────────────────────────────────────────────────

/**
 * Build a standard pagination meta object.
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 */
function pageMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

module.exports = {
  ok,
  created,
  noContent,
  accepted,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  paymentRequired,
  internal,
  fromError,
  pageMeta,
};
