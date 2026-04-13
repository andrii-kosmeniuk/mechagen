'use strict';

/**
 * Worker Contract Schemas — MechaGen
 *
 * Defines the strict request/response contract between the backend
 * and the CadQuery solid-generation worker.
 *
 * Backend sends → WorkerRequest
 * Worker responds → WorkerResponse | WorkerError
 */

// ── Request ────────────────────────────────────────────────────────────────────

/**
 * Validate a worker request payload before sending.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateWorkerRequest(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') { errors.push('payload must be an object'); return { valid: false, errors }; }
  if (!payload.jobId || typeof payload.jobId !== 'string')    errors.push('jobId (string) is required');
  if (!payload.cadScript || typeof payload.cadScript !== 'string') errors.push('cadScript (string) is required');
  if (payload.cadScript && payload.cadScript.length < 10)     errors.push('cadScript appears too short to be valid');
  if (payload.timeoutMs !== undefined && typeof payload.timeoutMs !== 'number') errors.push('timeoutMs must be a number');
  return { valid: errors.length === 0, errors };
}

/**
 * Build a canonical worker request object.
 * @param {object} opts
 * @param {string} opts.jobId        Generation ID
 * @param {string} opts.cadScript    CadQuery Python script
 * @param {string} [opts.outputFormat='stl']
 * @param {number} [opts.timeoutMs=120000]
 * @param {object} [opts.metadata]   Extra context (logged, not used by worker)
 * @returns {object}
 */
function buildWorkerRequest({ jobId, cadScript, outputFormat = 'stl', timeoutMs = 120_000, metadata = {} }) {
  return {
    jobId,
    cadScript,
    outputFormat,
    timeoutMs,
    metadata,
    sentAt: new Date().toISOString(),
  };
}

// ── Response ───────────────────────────────────────────────────────────────────

/**
 * Validate a worker response payload after receiving.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateWorkerResponse(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') { errors.push('worker response must be an object'); return { valid: false, errors }; }
  if (!payload.jobId)  errors.push('jobId is missing from worker response');
  if (!payload.status) errors.push('status is missing from worker response');
  if (!['success', 'error'].includes(payload.status)) errors.push(`unknown status: ${payload.status}`);
  if (payload.status === 'success') {
    if (!payload.stlBase64 && !payload.outputPath) errors.push('success response must have stlBase64 or outputPath');
  }
  if (payload.status === 'error') {
    if (!payload.error) errors.push('error response must have an error message');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Parse and normalize a raw worker response.
 * Returns a structured object with a consistent shape regardless of worker version.
 */
function parseWorkerResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'Invalid worker response format', code: 'WORKER_ERROR' };
  }
  if (raw.status === 'success') {
    return {
      success:       true,
      jobId:         raw.jobId,
      stlBase64:     raw.stlBase64 || null,
      outputPath:    raw.outputPath || null,
      warnings:      raw.warnings   || [],
      executionMs:   raw.executionMs || null,
      vertexCount:   raw.vertexCount || null,
      triangleCount: raw.triangleCount || null,
      completedAt:   raw.completedAt || new Date().toISOString(),
    };
  }
  return {
    success:  false,
    jobId:    raw.jobId,
    error:    raw.error || 'Worker execution failed',
    code:     raw.code  || 'WORKER_ERROR',
    detail:   raw.detail || null,
    failedAt: raw.failedAt || new Date().toISOString(),
  };
}

module.exports = {
  buildWorkerRequest,
  validateWorkerRequest,
  validateWorkerResponse,
  parseWorkerResponse,
};
