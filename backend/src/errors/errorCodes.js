'use strict';

/**
 * Error Codes — centralized registry of all application error codes.
 *
 * Usage:
 *   const { E } = require('./errorCodes');
 *   throw new AppError('Not found', 404, E.NOT_FOUND);
 */

const E = Object.freeze({
  // ── Generic ────────────────────────────────────────────────────────────────
  INTERNAL_ERROR:        'INTERNAL_ERROR',
  NOT_FOUND:             'NOT_FOUND',
  BAD_REQUEST:           'BAD_REQUEST',
  UNAUTHORIZED:          'UNAUTHORIZED',
  FORBIDDEN:             'FORBIDDEN',
  CONFLICT:              'CONFLICT',
  RATE_LIMITED:          'RATE_LIMITED',
  TIMEOUT:               'TIMEOUT',

  // ── Auth / API Keys ────────────────────────────────────────────────────────
  INVALID_API_KEY:       'INVALID_API_KEY',
  MISSING_AUTH:          'MISSING_AUTH',
  ADMIN_REQUIRED:        'ADMIN_REQUIRED',

  // ── Generation ─────────────────────────────────────────────────────────────
  GENERATION_NOT_FOUND:  'GENERATION_NOT_FOUND',
  GENERATION_IN_PROGRESS:'GENERATION_IN_PROGRESS',
  INVALID_PROMPT:        'INVALID_PROMPT',
  PIPELINE_FAILED:       'PIPELINE_FAILED',
  SPEC_INVALID:          'SPEC_INVALID',
  GEOMETRY_PLAN_INVALID: 'GEOMETRY_PLAN_INVALID',
  VALIDATION_FAILED:     'VALIDATION_FAILED',
  REPAIR_FAILED:         'REPAIR_FAILED',
  REPAIR_NOT_APPLICABLE: 'REPAIR_NOT_APPLICABLE',

  // ── Blueprint ──────────────────────────────────────────────────────────────
  BLUEPRINT_NOT_FOUND:   'BLUEPRINT_NOT_FOUND',
  BLUEPRINT_REQUIRED:    'BLUEPRINT_REQUIRED',
  BLUEPRINT_UPLOAD_FAILED:'BLUEPRINT_UPLOAD_FAILED',
  BLUEPRINT_ANALYSIS_FAILED:'BLUEPRINT_ANALYSIS_FAILED',

  // ── Export ─────────────────────────────────────────────────────────────────
  EXPORT_NOT_READY:      'EXPORT_NOT_READY',
  EXPORT_FAILED:         'EXPORT_FAILED',
  EXPORT_FORMAT_UNSUPPORTED:'EXPORT_FORMAT_UNSUPPORTED',
  STL_PLAN_REQUIRED:     'STL_PLAN_REQUIRED',

  // ── Solid Build ────────────────────────────────────────────────────────────
  SOLID_BUILD_NOT_FOUND: 'SOLID_BUILD_NOT_FOUND',
  SOLID_BUILD_FAILED:    'SOLID_BUILD_FAILED',
  SOLID_BUILD_IN_PROGRESS:'SOLID_BUILD_IN_PROGRESS',
  WORKER_UNAVAILABLE:    'WORKER_UNAVAILABLE',
  WORKER_TIMEOUT:        'WORKER_TIMEOUT',
  WORKER_ERROR:          'WORKER_ERROR',

  // ── Plans / Billing ────────────────────────────────────────────────────────
  PLAN_NOT_FOUND:        'PLAN_NOT_FOUND',
  QUOTA_EXCEEDED:        'QUOTA_EXCEEDED',
  CREDIT_INSUFFICIENT:   'CREDIT_INSUFFICIENT',
  PAYMENT_REQUIRED:      'PAYMENT_REQUIRED',
  FEATURE_NOT_IN_PLAN:   'FEATURE_NOT_IN_PLAN',

  // ── Workspace ──────────────────────────────────────────────────────────────
  WORKSPACE_NOT_FOUND:   'WORKSPACE_NOT_FOUND',
  WORKSPACE_ACCESS_DENIED:'WORKSPACE_ACCESS_DENIED',
  MEMBER_NOT_FOUND:      'MEMBER_NOT_FOUND',
  ALREADY_A_MEMBER:      'ALREADY_A_MEMBER',
  CANNOT_REMOVE_OWNER:   'CANNOT_REMOVE_OWNER',

  // ── Waitlist ───────────────────────────────────────────────────────────────
  MISSING_EMAIL:         'MISSING_EMAIL',
  INVALID_EMAIL:         'INVALID_EMAIL',
  ALREADY_ON_WAITLIST:   'ALREADY_ON_WAITLIST',

  // ── Feedback ───────────────────────────────────────────────────────────────
  INVALID_CATEGORY:      'INVALID_CATEGORY',
  MISSING_MESSAGE:       'MISSING_MESSAGE',
  INVALID_STATUS:        'INVALID_STATUS',

  // ── Onboarding ─────────────────────────────────────────────────────────────
  ONBOARDING_ALREADY_DONE:'ONBOARDING_ALREADY_DONE',
});

module.exports = { E };
