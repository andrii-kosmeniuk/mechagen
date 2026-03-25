'use strict';

/**
 * Generation Orchestration Service.
 *
 * Implements the full 8-stage pipeline:
 * Prompt → Spec JSON → Constraint Check → Geometry Plan → Deterministic Build
 *   → Validation → Repair → Export-ready
 *
 * Each stage is tracked via status updates.
 * Uses the existing AI client (lib/ai.js callNemotron / callCopilotChat).
 */

const { callNemotron } = require('../../lib/ai');
const {
  getSpecSystemPrompt,
  getGeometryPlanSystemPrompt,
  buildSpecUserMessage,
  buildGeometryPlanUserMessage,
} = require('./aiPrompts');
const { validateSpecJson, validateGeometryPlan } = require('../schemas/specSchema');
const { checkConstraints } = require('./constraintEngine');
const { validateGeometry }  = require('./validationEngine');
const { repairGeometryPlan, MAX_AUTO_REPAIR_ATTEMPTS } = require('./repairService');
const { buildPreviewFromPlan } = require('./previewBuilder');

/**
 * In-memory job store.
 * In production this would be a database table.
 * @type {Map<string, object>}
 */
const jobStore = new Map();

/** Generate a simple unique ID. */
function genId() {
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get a generation record by ID.
 * @param {string} id
 */
function getGeneration(id) {
  return jobStore.get(id) ?? null;
}

/**
 * Update a generation record.
 */
function updateGeneration(id, updates) {
  const existing = jobStore.get(id) || {};
  jobStore.set(id, {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  return jobStore.get(id);
}

/**
 * List all generation IDs (for history endpoint).
 */
function listGenerations() {
  return Array.from(jobStore.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/**
 * Calls the AI with a structured JSON-only request.
 * Retries once if the response is not valid JSON.
 *
 * @param {string} systemPromptOverride - system prompt to use
 * @param {string} userMessage
 * @param {object} options
 * @returns {Promise<object>}
 */
async function callAiForJson(systemPromptOverride, userMessage, options = {}) {
  // We use a monkey-patched version of callNemotron via options.
  // The existing callNemotron function uses module-level system prompts,
  // so we need to work around that by injecting the system prompt into the user message.
  // This is a pragmatic approach for the existing architecture.
  const combinedPrompt = `SYSTEM INSTRUCTIONS:\n${systemPromptOverride}\n\n---\n\n${userMessage}`;

  let raw;
  try {
    raw = await callNemotron(combinedPrompt, options.image || null, {
      highDetail: false,
      geometryParts: true, // reuses the JSON extraction logic
    });
  } catch (err) {
    throw err;
  }

  // Extract JSON from response
  let jsonStr = (raw || '').trim();
  const start = jsonStr.indexOf('{');
  const end   = jsonStr.lastIndexOf('}');
  if (start >= 0 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    // Retry once with a stricter reminder
    const retryPrompt = `${combinedPrompt}\n\nCRITICAL: Your previous response was not valid JSON. Output ONLY the JSON object, no markdown, no prose, no code fences.`;
    let raw2;
    try {
      raw2 = await callNemotron(retryPrompt, null, { geometryParts: true });
    } catch (err2) {
      throw new Error(`AI returned invalid JSON (even after retry): ${err.message}`);
    }
    let js2 = (raw2 || '').trim();
    const s2 = js2.indexOf('{');
    const e2 = js2.lastIndexOf('}');
    if (s2 >= 0 && e2 > s2) js2 = js2.slice(s2, e2 + 1);
    try {
      parsed = JSON.parse(js2);
    } catch {
      throw new Error('AI returned invalid JSON after retry. Cannot continue.');
    }
  }

  return parsed;
}

/**
 * Structured log emitter.
 */
function log(genId, stage, status, extra = {}) {
  console.log(JSON.stringify({
    requestId: genId,
    stage,
    status,
    timestamp: new Date().toISOString(),
    ...extra,
  }));
}

/**
 * Runs the full generation pipeline for a given input.
 * This is async and non-blocking — callers get the jobId immediately.
 *
 * @param {object} input
 * @param {string} input.prompt
 * @param {string} [input.context]
 * @param {string} [input.image]
 * @param {string} [input.projectName]
 * @param {string} [input.manufacturingMode]
 * @param {string} [input.materialPreference]
 * @param {boolean} [input.highDetail]
 * @param {string} [input.projectId]
 * @returns {{ jobId: string, status: string }}
 */
function startGeneration(input) {
  const id = genId();
  const now = new Date().toISOString();
  const record = {
    id,
    projectId: input.projectId || 'default-project',
    prompt: input.prompt || '',
    context: input.context || '',
    imageUrl: null,
    status: 'queued',
    manufacturingMode: input.manufacturingMode || 'unknown',
    materialPreference: input.materialPreference || '',
    highDetail: !!input.highDetail,
    specJson: null,
    constraintReport: null,
    geometryPlan: null,
    validationReport: null,
    repairHistory: [],
    buildMetadata: {},
    previewParts: null,
    stlBase64: null,
    errorContext: null,
    createdAt: now,
    updatedAt: now,
  };
  jobStore.set(id, record);

  // Run async without awaiting — respond immediately with jobId
  runPipeline(id, input).catch((err) => {
    console.error(`[pipeline] unhandled error for ${id}:`, err.message);
    updateGeneration(id, {
      status: 'failed',
      errorContext: err.message,
    });
  });

  return { jobId: id, status: 'queued' };
}

/**
 * Main async pipeline execution.
 */
async function runPipeline(id, input) {
  const t0 = Date.now();
  log(id, 'pipeline', 'started', { prompt: (input.prompt || '').slice(0, 80) });

  // ─── Stage 1: Validate input ──────────────────────────────────────────────
  if (!input.prompt?.trim() && !input.image) {
    updateGeneration(id, {
      status: 'failed',
      errorContext: 'No prompt and no image provided',
    });
    return;
  }

  // ─── Stage 2: Spec generation ─────────────────────────────────────────────
  updateGeneration(id, { status: 'spec_generating' });
  log(id, 'spec_generation', 'started');

  let specJson;
  try {
    const t1 = Date.now();
    const rawSpec = await callAiForJson(
      getSpecSystemPrompt(),
      buildSpecUserMessage(input),
      { image: input.image }
    );
    const { value: validatedSpec, errors: specErrors } = validateSpecJson(rawSpec);
    if (!validatedSpec) {
      throw new Error(`Spec validation failed: ${specErrors.join('; ')}`);
    }
    if (specErrors.length > 0) {
      log(id, 'spec_generation', 'schema_warnings', { warnings: specErrors });
    }
    specJson = validatedSpec;
    updateGeneration(id, { specJson });
    log(id, 'spec_generation', 'completed', { durationMs: Date.now() - t1, partType: specJson.partType });
  } catch (err) {
    log(id, 'spec_generation', 'failed', { error: err.message });
    updateGeneration(id, { status: 'failed', errorContext: `Spec generation failed: ${err.message}` });
    return;
  }

  // ─── Stage 3: Constraint check ────────────────────────────────────────────
  updateGeneration(id, { status: 'constraint_checking' });
  log(id, 'constraint_check', 'started');

  const constraintReport = checkConstraints(specJson, {
    prompt: input.prompt,
    hasImage: !!input.image,
  });

  updateGeneration(id, { constraintReport });
  log(id, 'constraint_check', 'completed', {
    isBuildable: constraintReport.isBuildable,
    severity: constraintReport.severity,
    errors: constraintReport.errors.length,
    warnings: constraintReport.warnings.length,
  });

  if (!constraintReport.isBuildable) {
    updateGeneration(id, {
      status: 'failed',
      errorContext: `Constraint check failed: ${constraintReport.errors.join('; ')}`,
    });
    return;
  }

  // ─── Stage 4: Geometry plan ───────────────────────────────────────────────
  updateGeneration(id, { status: 'planning' });
  log(id, 'geometry_planning', 'started');

  let geometryPlan;
  try {
    const t2 = Date.now();
    const rawPlan = await callAiForJson(
      getGeometryPlanSystemPrompt(),
      buildGeometryPlanUserMessage(specJson),
      {}
    );
    const { value: validatedPlan, errors: planErrors } = validateGeometryPlan(rawPlan);
    if (!validatedPlan || planErrors.length > 2) {
      throw new Error(`Geometry plan validation failed: ${planErrors.join('; ')}`);
    }
    if (planErrors.length > 0) {
      log(id, 'geometry_planning', 'schema_warnings', { warnings: planErrors });
    }
    geometryPlan = validatedPlan;
    updateGeneration(id, { geometryPlan });
    log(id, 'geometry_planning', 'completed', { durationMs: Date.now() - t2, steps: geometryPlan.buildSteps.length });
  } catch (err) {
    log(id, 'geometry_planning', 'failed', { error: err.message });
    updateGeneration(id, { status: 'failed', errorContext: `Geometry planning failed: ${err.message}` });
    return;
  }

  // ─── Stage 5: Deterministic preview build ─────────────────────────────────
  updateGeneration(id, { status: 'building_preview' });
  log(id, 'preview_build', 'started');

  let previewResult;
  try {
    previewResult = buildPreviewFromPlan(geometryPlan);
    updateGeneration(id, { previewParts: previewResult.parts });
    log(id, 'preview_build', 'completed', { parts: previewResult.parts.length });
  } catch (err) {
    log(id, 'preview_build', 'failed', { error: err.message });
    updateGeneration(id, { status: 'failed', errorContext: `Preview build failed: ${err.message}` });
    return;
  }

  // ─── Stage 6: Validation ──────────────────────────────────────────────────
  updateGeneration(id, { status: 'validating' });
  log(id, 'validation', 'started');

  let validationReport = validateGeometry(geometryPlan, specJson);
  updateGeneration(id, { validationReport });
  log(id, 'validation', 'completed', {
    valid: validationReport.valid,
    errors: validationReport.errors.length,
    warnings: validationReport.warnings.length,
  });

  // ─── Stage 7: Repair loop ─────────────────────────────────────────────────
  let repairHistory = [];
  if (!validationReport.valid && validationReport.repairable) {
    updateGeneration(id, { status: 'repairing' });

    for (let attempt = 1; attempt <= MAX_AUTO_REPAIR_ATTEMPTS; attempt++) {
      log(id, 'repair', 'started', { attempt });
      const repairOutput = repairGeometryPlan({
        geometryPlan,
        spec: specJson,
        issues: validationReport.errors,
        attemptNumber: attempt,
      });
      repairHistory.push(repairOutput);
      updateGeneration(id, { repairHistory });

      if (repairOutput.changesApplied.length > 0 && repairOutput.updatedGeometryPlan) {
        geometryPlan = repairOutput.updatedGeometryPlan;
        updateGeneration(id, { geometryPlan });

        // Re-validate
        validationReport = validateGeometry(geometryPlan, specJson);
        updateGeneration(id, { validationReport });
        log(id, 'repair', 'revalidated', {
          attempt,
          valid: validationReport.valid,
          changes: repairOutput.changesApplied.length,
        });

        if (validationReport.valid) {
          // Rebuild preview with repaired plan
          previewResult = buildPreviewFromPlan(geometryPlan);
          updateGeneration(id, { previewParts: previewResult.parts });
          break;
        }
      } else {
        log(id, 'repair', 'no_changes', { attempt });
        break;
      }
    }
  }

  // ─── Stage 8: Done ────────────────────────────────────────────────────────
  const finalStatus =
    validationReport.valid || validationReport.severity === 'low' ? 'ready' : 'ready'; // always surface result

  updateGeneration(id, {
    status: finalStatus,
    buildMetadata: {
      totalDurationMs: Date.now() - t0,
      previewPartCount: previewResult.parts.length,
      validationPassed: validationReport.valid,
      repairAttempts: repairHistory.length,
      specConfidence: specJson.confidence,
    },
  });

  log(id, 'pipeline', 'completed', {
    status: finalStatus,
    durationMs: Date.now() - t0,
    validationPassed: validationReport.valid,
  });
}

/**
 * Triggers a manual repair on an existing generation (Phase 2 endpoint).
 */
async function triggerRepair(generationId) {
  const gen = getGeneration(generationId);
  if (!gen) throw Object.assign(new Error('Generation not found'), { status: 404 });
  if (!gen.geometryPlan) throw Object.assign(new Error('No geometry plan to repair'), { status: 400 });
  if (!gen.validationReport) throw Object.assign(new Error('No validation report to repair from'), { status: 400 });
  if (gen.validationReport.valid) throw Object.assign(new Error('Validation already passed — no repair needed'), { status: 400 });

  const repairHistory = gen.repairHistory || [];
  const attempt = repairHistory.length + 1;

  if (attempt > MAX_AUTO_REPAIR_ATTEMPTS + 1) {
    throw Object.assign(new Error('Maximum repair attempts reached'), { status: 400 });
  }

  updateGeneration(generationId, { status: 'repairing' });

  const repairOutput = repairGeometryPlan({
    geometryPlan: gen.geometryPlan,
    spec: gen.specJson || {},
    issues: gen.validationReport.errors,
    attemptNumber: attempt,
  });

  repairHistory.push(repairOutput);

  let geometryPlan = repairOutput.updatedGeometryPlan || gen.geometryPlan;
  const validationReport = validateGeometry(geometryPlan, gen.specJson || {});
  const previewResult = buildPreviewFromPlan(geometryPlan);

  updateGeneration(generationId, {
    geometryPlan,
    validationReport,
    repairHistory,
    previewParts: previewResult.parts,
    status: 'ready',
  });

  return getGeneration(generationId);
}

module.exports = {
  startGeneration,
  getGeneration,
  updateGeneration,
  listGenerations,
  triggerRepair,
};
