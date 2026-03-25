'use strict';

/**
 * Generation Orchestration Service.
 *
 * Refactored: in-memory jobStore replaced with generationRepo
 * (JSON-file backed persistence — survives restarts).
 *
 * Phase 2: adds analyzing_blueprint stage (Stage 1b).
 * Pipeline: Prompt → [Blueprint Analysis] → Spec → Constraint → Plan → Build → Validate → Repair → Ready
 */


const { callNemotron } = require('../../lib/ai');
const {
  getSpecSystemPrompt,
  getGeometryPlanSystemPrompt,
  buildSpecUserMessage,
  buildBlueprintAwareSpecUserMessage,
  buildGeometryPlanUserMessage,
} = require('./aiPrompts');
const { validateSpecJson, validateGeometryPlan } = require('../schemas/specSchema');
const { checkConstraints } = require('./constraintEngine');
const { validateGeometry }  = require('./validationEngine');
const { repairGeometryPlan, MAX_AUTO_REPAIR_ATTEMPTS } = require('./repairService');
const { buildPreviewFromPlan } = require('./previewBuilder');
const { analyzeBlueprintById, mergeBlueprintHintsIntoContext } = require('./blueprintAnalysis');
const { linkBlueprintToGeneration } = require('./blueprintService');

/** Persistent generation store — replaces the in-memory Map. */
const repo = require('../repositories/generationRepo');

function genId() {
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getGeneration(id) {
  return repo.get(id);
}

function updateGeneration(id, updates) {
  return repo.update(id, updates);
}

function listGenerations() {
  return repo.list();
}


async function callAiForJson(systemPromptOverride, userMessage, options = {}) {
  const combinedPrompt = `SYSTEM INSTRUCTIONS:\n${systemPromptOverride}\n\n---\n\n${userMessage}`;

  let raw;
  try {
    raw = await callNemotron(combinedPrompt, options.image || null, {
      highDetail: false,
      geometryParts: true,
    });
  } catch (err) {
    throw err;
  }

  let jsonStr = (raw || '').trim();
  const start = jsonStr.indexOf('{');
  const end   = jsonStr.lastIndexOf('}');
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    const retryPrompt = `${combinedPrompt}\n\nCRITICAL: Your previous response was not valid JSON. Output ONLY the JSON object, no markdown, no prose, no code fences.`;
    let raw2;
    try {
      raw2 = await callNemotron(retryPrompt, null, { geometryParts: true });
    } catch (err2) {
      throw new Error(`AI returned invalid JSON (even after retry): ${err.message}`);
    }
    let js2 = (raw2 || '').trim();
    const s2 = js2.indexOf('{'); const e2 = js2.lastIndexOf('}');
    if (s2 >= 0 && e2 > s2) js2 = js2.slice(s2, e2 + 1);
    try { parsed = JSON.parse(js2); }
    catch { throw new Error('AI returned invalid JSON after retry. Cannot continue.'); }
  }

  return parsed;
}

function log(genId, stage, status, extra = {}) {
  console.log(JSON.stringify({ requestId: genId, stage, status, timestamp: new Date().toISOString(), ...extra }));
}

function startGeneration(input) {
  const id  = genId();
  const now = new Date().toISOString();
  const record = {
    id,
    projectId:          input.projectId || 'default-project',
    prompt:             input.prompt || '',
    context:            input.context || '',
    imageUrl:           null,
    status:             'queued',
    blueprintId:        input.blueprintId || null,
    blueprintAnalysis:  null,
    manufacturingMode:  input.manufacturingMode || 'unknown',
    materialPreference: input.materialPreference || '',
    highDetail:         !!input.highDetail,
    specJson:           null,
    constraintReport:   null,
    geometryPlan:       null,
    validationReport:   null,
    repairHistory:      [],
    buildMetadata:      {},
    previewParts:       null,
    stlBase64:          null,
    errorContext:       null,
    // Phase 3
    solidRequested:     !!input.solidRequested,
    solidStatus:        null,
    createdAt:          now,
    updatedAt:          now,
  };
  repo.set(id, record);

  runPipeline(id, input).catch((err) => {
    console.error(`[pipeline] unhandled error for ${id}:`, err.message);
    updateGeneration(id, { status: 'failed', errorContext: err.message });
  });

  return { jobId: id, status: 'queued' };
}

async function runPipeline(id, input) {
  const t0 = Date.now();
  log(id, 'pipeline', 'started', { prompt: (input.prompt || '').slice(0, 80) });

  // ─── Stage 1: Validate input ──────────────────────────────────────────────
  if (!input.prompt?.trim() && !input.image && !input.blueprintId) {
    updateGeneration(id, { status: 'failed', errorContext: 'No prompt, image, or blueprint provided' });
    return;
  }

  // ─── Stage 1b: Blueprint analysis (non-fatal) ───────────────────────────
  let blueprintHints = null;
  if (input.blueprintId) {
    updateGeneration(id, { status: 'analyzing_blueprint' });
    log(id, 'blueprint_analysis', 'started', { blueprintId: input.blueprintId });
    try {
      const analysis = await analyzeBlueprintById(input.blueprintId);
      linkBlueprintToGeneration(input.blueprintId, id);
      updateGeneration(id, { blueprintAnalysis: analysis });
      blueprintHints = mergeBlueprintHintsIntoContext(analysis);
      log(id, 'blueprint_analysis', 'completed', {
        confidence: analysis.confidence,
        partType: analysis.detectedPartType,
      });
    } catch (err) {
      log(id, 'blueprint_analysis', 'failed_non_fatal', { error: err.message });
    }
  }

  // ─── Stage 2: Spec generation ─────────────────────────────────────────────
  updateGeneration(id, { status: 'spec_generating' });
  log(id, 'spec_generation', 'started');

  let specJson;
  try {
    const t1 = Date.now();
    const userMessage = blueprintHints
      ? buildBlueprintAwareSpecUserMessage(input, blueprintHints)
      : buildSpecUserMessage(input);
    const rawSpec = await callAiForJson(getSpecSystemPrompt(), userMessage, { image: input.image });
    const { value: validatedSpec, errors: specErrors } = validateSpecJson(rawSpec);
    if (!validatedSpec) throw new Error(`Spec validation failed: ${specErrors.join('; ')}`);
    if (specErrors.length > 0) log(id, 'spec_generation', 'schema_warnings', { warnings: specErrors });
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
    hasImage: !!input.image || !!input.blueprintId,
  });
  updateGeneration(id, { constraintReport });
  log(id, 'constraint_check', 'completed', {
    isBuildable: constraintReport.isBuildable,
    errors: constraintReport.errors.length,
    warnings: constraintReport.warnings.length,
  });

  if (!constraintReport.isBuildable) {
    updateGeneration(id, { status: 'failed', errorContext: `Constraint check failed: ${constraintReport.errors.join('; ')}` });
    return;
  }

  // ─── Stage 4: Geometry plan ───────────────────────────────────────────────
  updateGeneration(id, { status: 'planning' });
  log(id, 'geometry_planning', 'started');

  let geometryPlan;
  try {
    const t2 = Date.now();
    const rawPlan = await callAiForJson(getGeometryPlanSystemPrompt(), buildGeometryPlanUserMessage(specJson), {});
    const { value: validatedPlan, errors: planErrors } = validateGeometryPlan(rawPlan);
    if (!validatedPlan || planErrors.length > 2) throw new Error(`Geometry plan validation failed: ${planErrors.join('; ')}`);
    if (planErrors.length > 0) log(id, 'geometry_planning', 'schema_warnings', { warnings: planErrors });
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
        geometryPlan, spec: specJson, issues: validationReport.errors, attemptNumber: attempt,
      });
      repairHistory.push(repairOutput);
      updateGeneration(id, { repairHistory });
      if (repairOutput.changesApplied.length > 0 && repairOutput.updatedGeometryPlan) {
        geometryPlan = repairOutput.updatedGeometryPlan;
        updateGeneration(id, { geometryPlan });
        validationReport = validateGeometry(geometryPlan, specJson);
        updateGeneration(id, { validationReport });
        log(id, 'repair', 'revalidated', { attempt, valid: validationReport.valid });
        if (validationReport.valid) {
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
  updateGeneration(id, {
    status: 'ready',
    buildMetadata: {
      totalDurationMs:  Date.now() - t0,
      previewPartCount: previewResult.parts.length,
      validationPassed: validationReport.valid,
      repairAttempts:   repairHistory.length,
      specConfidence:   specJson.confidence,
      hadBlueprint:     !!input.blueprintId,
    },
  });
  log(id, 'pipeline', 'completed', { durationMs: Date.now() - t0, validationPassed: validationReport.valid });
}

async function triggerRepair(generationId) {
  const gen = getGeneration(generationId);
  if (!gen)                        throw Object.assign(new Error('Generation not found'), { status: 404 });
  if (!gen.geometryPlan)           throw Object.assign(new Error('No geometry plan to repair'), { status: 400 });
  if (!gen.validationReport)       throw Object.assign(new Error('No validation report'), { status: 400 });
  if (gen.validationReport.valid)  throw Object.assign(new Error('Validation already passed'), { status: 400 });
  if (!gen.validationReport.repairable) throw Object.assign(new Error('Issues are not auto-repairable'), { status: 400 });

  const repairHistory = gen.repairHistory || [];
  const attempt = repairHistory.length + 1;
  if (attempt > MAX_AUTO_REPAIR_ATTEMPTS + 1) throw Object.assign(new Error('Maximum repair attempts reached'), { status: 400 });

  updateGeneration(generationId, { status: 'repairing' });
  const repairOutput = repairGeometryPlan({
    geometryPlan: gen.geometryPlan, spec: gen.specJson || {},
    issues: gen.validationReport.errors, attemptNumber: attempt,
  });
  repairHistory.push(repairOutput);
  const geometryPlan    = repairOutput.updatedGeometryPlan || gen.geometryPlan;
  const validationReport = validateGeometry(geometryPlan, gen.specJson || {});
  const previewResult   = buildPreviewFromPlan(geometryPlan);

  updateGeneration(generationId, {
    geometryPlan, validationReport, repairHistory,
    previewParts: previewResult.parts, status: 'ready',
  });
  return getGeneration(generationId);
}

module.exports = { startGeneration, getGeneration, updateGeneration, listGenerations, triggerRepair };
