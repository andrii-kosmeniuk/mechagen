'use strict';

/**
 * CadQuery Worker Client — MechaGen
 *
 * Clean abstraction over HTTP calls to the Python/CadQuery solid worker.
 * Handles: request construction, timeout, structured error mapping, retry.
 *
 * The worker must be running at WORKER_URL (default: http://127.0.0.1:5001).
 */

const http  = require('http');
const https = require('https');
const { buildWorkerRequest, validateWorkerRequest, validateWorkerResponse, parseWorkerResponse } = require('../../schemas/workerContract');
const { AppError } = require('../../errors/AppError');
const { E }        = require('../../errors/errorCodes');

// ── Config ─────────────────────────────────────────────────────────────────────

function getWorkerConfig() {
  const workerUrl = process.env.WORKER_URL || 'http://127.0.0.1:5001';
  const timeout   = parseInt(process.env.WORKER_TIMEOUT || '120000', 10);
  return { workerUrl, timeout };
}

// ── Low-level HTTP call ────────────────────────────────────────────────────────

/**
 * Send a JSON body to the worker and receive a JSON response.
 * @param {string} workerUrl
 * @param {object} body
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
function callWorkerHttp(workerUrl, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url     = new URL(workerUrl);
    const payload = JSON.stringify(body);
    const lib     = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname || '/generate',
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout:  timeoutMs,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new AppError(`Worker returned non-JSON: ${data.slice(0, 200)}`, 502, E.WORKER_ERROR));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new AppError(`Worker timed out after ${timeoutMs}ms`, 504, E.WORKER_TIMEOUT));
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        reject(new AppError('CadQuery worker is not available', 503, E.WORKER_UNAVAILABLE));
      } else {
        reject(new AppError(`Worker connection error: ${err.message}`, 502, E.WORKER_ERROR));
      }
    });

    req.write(payload);
    req.end();
  });
}

// ── Public client API ──────────────────────────────────────────────────────────

/**
 * Send a solid build job to the CadQuery worker.
 *
 * @param {object} opts
 * @param {string} opts.jobId         Generation or solid build ID
 * @param {string} opts.cadScript     CadQuery Python script to execute
 * @param {string} [opts.outputFormat='stl']
 * @param {object} [opts.metadata]    Extra context attached to the request
 * @returns {Promise<object>}         Normalized worker response
 */
async function runSolidBuild({ jobId, cadScript, outputFormat = 'stl', metadata = {} }) {
  const { workerUrl, timeout } = getWorkerConfig();

  // Build and validate request
  const request = buildWorkerRequest({ jobId, cadScript, outputFormat, timeoutMs: timeout, metadata });
  const reqVal  = validateWorkerRequest(request);
  if (!reqVal.valid) {
    throw new AppError(`Invalid worker request: ${reqVal.errors.join(', ')}`, 400, E.BAD_REQUEST);
  }

  // Send with retry (1 retry on connection errors only)
  let rawResponse;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      rawResponse = await callWorkerHttp(workerUrl, request, timeout);
      break;
    } catch (err) {
      lastError = err;
      // Only retry on worker-unavailable (not on timeout or parsing errors)
      if (err.code !== E.WORKER_UNAVAILABLE || attempt === 2) throw err;
      console.warn(`[workerClient] attempt ${attempt} failed (${err.code}), retrying…`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Validate response
  const resVal = validateWorkerResponse(rawResponse);
  if (!resVal.valid) {
    console.error('[workerClient] invalid response shape:', resVal.errors, rawResponse);
    throw new AppError(`Worker returned invalid response: ${resVal.errors.join(', ')}`, 502, E.WORKER_ERROR);
  }

  // Parse and normalize
  const result = parseWorkerResponse(rawResponse);

  if (!result.success) {
    throw new AppError(result.error || 'Worker build failed', 422, result.code || E.SOLID_BUILD_FAILED);
  }

  return result;
}

/**
 * Check if the worker is reachable.
 * @returns {Promise<boolean>}
 */
async function pingWorker() {
  try {
    const { workerUrl } = getWorkerConfig();
    await callWorkerHttp(workerUrl.replace(/\/generate$/, '/health') + '/health', {}, 3000);
    return true;
  } catch {
    return false;
  }
}

module.exports = { runSolidBuild, pingWorker };
