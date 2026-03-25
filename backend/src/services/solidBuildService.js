'use strict';

/**
 * Solid Build Service — Phase 3
 *
 * Orchestrates the solid generation pipeline:
 *   1. Translate geometry plan → CadQuery source (deterministic)
 *   2. Spawn Python worker child process with timeout
 *   3. Capture structured result
 *   4. Persist build record to in-memory store
 */

const { spawn }      = require('child_process');
const path           = require('path');
const fs             = require('fs');
const { randomUUID } = require('crypto');
const { translateToCadQuery } = require('./cadqueryTranslator');

// ─── Config ────────────────────────────────────────────────────────────────────

const WORKER_SCRIPT   = path.join(__dirname, '../../../worker/cadquery_worker.py');
const STL_OUTPUT_DIR  = path.join(__dirname, '../../uploads/solids');
const DEFAULT_TIMEOUT = parseInt(process.env.CADQUERY_TIMEOUT_MS || '60000', 10); // 60s

if (!fs.existsSync(STL_OUTPUT_DIR)) fs.mkdirSync(STL_OUTPUT_DIR, { recursive: true });

// ─── In-memory store ───────────────────────────────────────────────────────────

/** @type {Map<string, object>} */
const solidBuildStore = new Map();

function getSolidBuild(buildId) { return solidBuildStore.get(buildId) ?? null; }
function getSolidBuildByGenerationId(genId) {
  return Array.from(solidBuildStore.values()).find(b => b.generationId === genId) ?? null;
}

// ─── Python detection ──────────────────────────────────────────────────────────

function getPythonExecutable() {
  // Check env var first (for venv)
  if (process.env.CADQUERY_PYTHON) return process.env.CADQUERY_PYTHON;
  // Prefer python3, fall back to python
  const candidates = ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      const result = require('child_process').execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' }).trim();
      if (result) return cmd;
    } catch {}
  }
  return 'python3'; // best-effort default
}

// ─── Worker spawn ──────────────────────────────────────────────────────────────

/**
 * Spawn the Python worker process and return a structured result.
 *
 * @param {{ jobId: string, source: string, outputPath: string, timeoutMs: number }} job
 * @returns {Promise<object>} worker result JSON
 */
function spawnWorker(job) {
  return new Promise((resolve) => {
    const python = getPythonExecutable();
    const jobPayload = JSON.stringify(job);

    const workerEnv = {
      ...process.env,
      // Ensure venv activated if CADQUERY_VENV is set
      ...(process.env.CADQUERY_VENV
        ? { VIRTUAL_ENV: process.env.CADQUERY_VENV,
            PATH: `${path.join(process.env.CADQUERY_VENV, 'bin')}:${process.env.PATH}` }
        : {}),
    };

    let proc;
    try {
      proc = spawn(python, [WORKER_SCRIPT], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: workerEnv,
        timeout: job.timeoutMs + 5000, // extra grace period
      });
    } catch (err) {
      resolve({
        jobId: job.jobId, success: false, stlPath: null, stlSizeBytes: null,
        executionMs: 0, stdout: '', stderr: '',
        error: `Failed to spawn Python worker: ${err.message}`,
        meshCheck: null,
      });
      return;
    }

    let stdoutBuf = '';
    let stderrBuf = '';
    let timedOut  = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGKILL'); } catch {}
    }, job.timeoutMs);

    proc.stdout.on('data', chunk => { stdoutBuf += chunk.toString(); });
    proc.stderr.on('data', chunk => { stderrBuf += chunk.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut) {
        resolve({
          jobId: job.jobId, success: false, stlPath: null, stlSizeBytes: null,
          executionMs: job.timeoutMs, stdout: stdoutBuf, stderr: stderrBuf,
          error: `Worker timed out after ${job.timeoutMs}ms`,
          meshCheck: null,
        });
        return;
      }

      // Try to parse the last JSON line from stdout
      const lines = stdoutBuf.trim().split('\n').filter(Boolean);
      const lastLine = lines[lines.length - 1] || '';
      let parsed = null;
      try {
        parsed = JSON.parse(lastLine);
      } catch {
        resolve({
          jobId: job.jobId, success: false, stlPath: null, stlSizeBytes: null,
          executionMs: 0, stdout: stdoutBuf, stderr: stderrBuf,
          error: `Worker returned non-JSON output (exit ${code}): ${lastLine.slice(0, 300)}`,
          meshCheck: null,
        });
        return;
      }

      resolve(parsed);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        jobId: job.jobId, success: false, stlPath: null, stlSizeBytes: null,
        executionMs: 0, stdout: stdoutBuf, stderr: stderrBuf,
        error: `Worker process error: ${err.message}`,
        meshCheck: null,
      });
    });

    // Send job to worker stdin
    proc.stdin.write(jobPayload);
    proc.stdin.end();
  });
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Start a solid build for a generation.
 *
 * @param {object} generation - from orchestration.getGeneration()
 * @param {{ timeoutMs?: number }} opts
 * @returns {Promise<object>} solid build record
 */
async function startSolidBuild(generation, opts = {}) {
  if (!generation) throw Object.assign(new Error('Generation not found'), { status: 404 });
  if (!generation.geometryPlan) throw Object.assign(new Error('No geometry plan to build solid from'), { status: 400 });
  if (!['ready', 'solid_failed'].includes(generation.status)) {
    throw Object.assign(new Error(`Generation status is "${generation.status}" — must be preview-ready first`), { status: 400 });
  }

  const buildId    = randomUUID();
  const timeoutMs  = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const stlName    = `${(generation.specJson?.partType || 'part').replace(/_/g,'_')}_${buildId.slice(0,8)}.stl`;
  const outputPath = path.join(STL_OUTPUT_DIR, stlName);

  // Create initial record
  const record = {
    id:                buildId,
    generationId:      generation.id,
    status:            'translating_solid',
    translatorVersion: null,
    cadquerySource:    null,
    workerJobId:       buildId,
    executionTimeMs:   null,
    stdoutText:        '',
    stderrText:        '',
    stlFileUrl:        null,
    stlFilePath:       null,
    stlFileSizeBytes:  null,
    meshCheck:         null,
    validationJson:    null,
    errorReason:       null,
    createdAt:         new Date().toISOString(),
    updatedAt:         new Date().toISOString(),
  };
  solidBuildStore.set(buildId, record);

  // Run async
  _runSolidBuild(record, generation, outputPath, stlName, timeoutMs).catch(err => {
    console.error(`[solidBuild] unhandled error for ${buildId}:`, err.message);
    _updateBuild(buildId, {
      status: 'solid_failed',
      errorReason: err.message,
    });
  });

  return { buildId, status: 'translating_solid' };
}

function _updateBuild(buildId, updates) {
  const existing = solidBuildStore.get(buildId) || {};
  const updated  = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  solidBuildStore.set(buildId, updated);
  return updated;
}

async function _runSolidBuild(record, generation, outputPath, stlName, timeoutMs) {
  const buildId = record.id;

  // 1. Translate
  let translationResult;
  try {
    translationResult = translateToCadQuery(generation.geometryPlan);
  } catch (err) {
    _updateBuild(buildId, {
      status: 'solid_failed',
      errorReason: `Translation failed: ${err.message}`,
    });
    return;
  }

  _updateBuild(buildId, {
    status:            'building_solid',
    translatorVersion: translationResult.translatorVersion,
    cadquerySource:    translationResult.source,
  });

  // 2. Check if Python/CadQuery worker script exists
  if (!fs.existsSync(WORKER_SCRIPT)) {
    _updateBuild(buildId, {
      status:      'solid_failed',
      errorReason: `Python worker not found at ${WORKER_SCRIPT}. Run: cd worker && pip install cadquery`,
    });
    return;
  }

  // 3. Spawn worker
  const workerResult = await spawnWorker({
    jobId:      buildId,
    source:     translationResult.source,
    outputPath,
    timeoutMs,
  });

  if (!workerResult.success) {
    _updateBuild(buildId, {
      status:          'solid_failed',
      executionTimeMs: workerResult.executionMs,
      stdoutText:      workerResult.stdout ? workerResult.stdout.slice(0, 4000) : '',
      stderrText:      workerResult.stderr ? workerResult.stderr.slice(0, 4000) : '',
      errorReason:     workerResult.error,
      meshCheck:       workerResult.meshCheck,
    });
    return;
  }

  // 4. Solid-validate
  _updateBuild(buildId, { status: 'solid_validating' });

  const { validateSolidBuild } = require('./solidValidationService');
  const validation = validateSolidBuild(workerResult);

  if (!validation.solidValid) {
    _updateBuild(buildId, {
      status:          'solid_failed',
      executionTimeMs: workerResult.executionMs,
      stdoutText:      workerResult.stdout?.slice(0, 4000),
      stderrText:      workerResult.stderr?.slice(0, 4000),
      errorReason:     validation.reason,
      validationJson:  validation,
      meshCheck:       workerResult.meshCheck,
    });
    return;
  }

  // 5. Success
  _updateBuild(buildId, {
    status:           'solid_ready',
    executionTimeMs:  workerResult.executionMs,
    stdoutText:       workerResult.stdout?.slice(0, 4000),
    stderrText:       '',
    stlFilePath:      outputPath,
    stlFileUrl:       `/uploads/solids/${stlName}`,
    stlFileSizeBytes: workerResult.stlSizeBytes,
    meshCheck:        workerResult.meshCheck,
    validationJson:   validation,
    errorReason:      null,
  });

  console.log(`[solidBuild] ✅ solid_ready for gen ${generation.id} — ${(workerResult.stlSizeBytes / 1024).toFixed(0)} KB STL in ${workerResult.executionMs}ms`);
}

module.exports = {
  startSolidBuild,
  getSolidBuild,
  getSolidBuildByGenerationId,
  getSolidBuildStore: () => Array.from(solidBuildStore.values()),
};
