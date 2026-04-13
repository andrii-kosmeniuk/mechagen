'use strict';

/**
 * AppError — typed application error model.
 *
 * Usage:
 *   throw new AppError('Generation not found', 404, 'NOT_FOUND');
 *   throw AppError.badRequest('Invalid category');
 *   throw AppError.notFound('Blueprint');
 *
 * In handlers:
 *   catch (err) {
 *     const { status, code, message } = AppError.from(err);
 *     res.status(status).json({ error: message, code });
 *   }
 */

class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} status   HTTP status code
   * @param {string} code     Machine-readable error code (SCREAMING_SNAKE)
   * @param {object} [meta]   Optional extra context (logged, not sent to client)
   */
  constructor(message, status = 500, code = 'INTERNAL_ERROR', meta = {}) {
    super(message);
    this.name    = 'AppError';
    this.status  = status;
    this.code    = code;
    this.meta    = meta;
    if (Error.captureStackTrace) Error.captureStackTrace(this, AppError);
  }

  // ── Factory shortcuts ──────────────────────────────────────────────────────

  static badRequest(message, code = 'BAD_REQUEST', meta) {
    return new AppError(message, 400, code, meta);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED', meta) {
    return new AppError(message, 401, code, meta);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN', meta) {
    return new AppError(message, 403, code, meta);
  }

  static notFound(resource = 'Resource', code = 'NOT_FOUND', meta) {
    return new AppError(`${resource} not found`, 404, code, meta);
  }

  static conflict(message, code = 'CONFLICT', meta) {
    return new AppError(message, 409, code, meta);
  }

  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMITED', meta) {
    return new AppError(message, 429, code, meta);
  }

  static paymentRequired(message, code = 'QUOTA_EXCEEDED', meta) {
    return new AppError(message, 402, code, meta);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR', meta) {
    return new AppError(message, 500, code, meta);
  }

  // ── Normalise any thrown value into an AppError-shaped object ─────────────

  /**
   * Convert any error into a safe { status, code, message } object.
   * Supports plain Error objects that have .status and .code (from earlier phases).
   */
  static from(err) {
    if (err instanceof AppError) return err;
    const status  = err?.status  || 500;
    const code    = err?.code    || 'INTERNAL_ERROR';
    const message = err?.message || 'Unknown error';
    return { status, code, message };
  }

  /**
   * Standard Express / handler error responder.
   */
  static respond(res, err) {
    const { status, code, message } = AppError.from(err);
    if (status >= 500) {
      console.error(`[error] ${code}: ${message}`, err?.meta || '');
    }
    return res.status(status).json({ error: message, code });
  }

  toJSON() {
    return { error: this.message, code: this.code };
  }
}

module.exports = { AppError };
