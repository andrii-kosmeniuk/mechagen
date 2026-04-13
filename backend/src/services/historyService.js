'use strict';

/**
 * History Service — Phase 2
 *
 * Aggregates all Phase 2 artifacts for a project into a unified history view.
 * Uses the existing in-memory stores from Phase 1 (orchestration) and Phase 2 (blueprint, export).
 */

const { listGenerations, getGeneration } = require('./orchestration');
const { listBlueprintsForProject }       = require('./blueprintService');
const { getExportsForGeneration }        = require('./exportService');
const { getSolidBuildByGenerationId }    = require('./solidBuildService');

/**
 * Get full project history, ordered by newest first.
 *
 * @param {string} projectId
 * @returns {{
 *   projectId: string,
 *   generations: object[],
 *   blueprints: object[],
 *   exports: object[],
 *   totalGenerations: number,
 *   totalBlueprints: number,
 *   totalExports: number,
 * }}
 */
function getProjectHistory(projectId) {
  const allGenerations = listGenerations()
    .filter(g => g.projectId === projectId);

  const allBlueprints = listBlueprintsForProject(projectId);

  const allExports = [];
  for (const gen of allGenerations) {
    allExports.push(...getExportsForGeneration(gen.id));
  }

  // Sort exports newest first
  allExports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Attach solid build status to each generation summary
  const generationSummaries = allGenerations.map(g => {
    const solidBuild = getSolidBuildByGenerationId(g.id);
    return {
      id:             g.id,
      status:         g.status,
      solidStatus:    solidBuild?.status ?? g.solidStatus ?? null,
      solidRequested: g.solidRequested ?? false,
      prompt:         g.prompt,
      createdAt:      g.createdAt,
      blueprintId:    g.blueprintId ?? null,
      partType:       g.specJson?.partType ?? null,
      stlFileUrl:     solidBuild?.stlFileUrl ?? null,
    };
  });

  return {
    projectId,
    generations: generationSummaries,
    blueprints:  allBlueprints,
    exports:     allExports,
    totalGenerations: allGenerations.length,
    totalBlueprints:  allBlueprints.length,
    totalExports:     allExports.length,
  };
}

/**
 * Get the full pipeline timeline for a single generation.
 * Returns a chronological array of timeline events.
 */
function getGenerationTimeline(generationId) {
  const gen = getGeneration(generationId);
  if (!gen) return null;

  const events = [];

  const addEvent = (stage, data = {}) => {
    events.push({
      stage,
      timestamp: gen.createdAt, // approximate — we don't track per-stage timestamps yet
      ...data,
    });
  };

  if (gen.prompt) addEvent('prompt', { prompt: gen.prompt });
  if (gen.specJson) addEvent('spec_generated', {
    partType: gen.specJson.partType,
    confidence: gen.specJson.confidence,
    assumedCount: Object.keys(gen.specJson.assumedDimensions || {}).length,
  });
  if (gen.constraintReport) addEvent('constraint_checked', {
    isBuildable: gen.constraintReport.isBuildable,
    errorCount: gen.constraintReport.errors.length,
    warningCount: gen.constraintReport.warnings.length,
  });
  if (gen.geometryPlan) addEvent('geometry_planned', {
    stepCount: (gen.geometryPlan.buildSteps || []).length,
  });
  if (gen.previewParts) addEvent('preview_built', {
    partCount: gen.previewParts.length,
  });
  if (gen.validationReport) addEvent('validated', {
    valid: gen.validationReport.valid,
    severity: gen.validationReport.severity,
    checksRun: gen.validationReport.checksRun?.length,
  });
  for (const r of gen.repairHistory || []) {
    addEvent('repaired', {
      attempt: r.repairAttempt,
      changesApplied: r.changesApplied.length,
      resultStatus: r.resultStatus,
    });
  }

  const exports = getExportsForGeneration(generationId);
  for (const e of exports) {
    addEvent('exported', { type: e.type, fileUrl: e.fileUrl, fileSize: e.fileSize });
  }

  // Phase 3: solid build events
  const solidBuild = getSolidBuildByGenerationId(generationId);
  if (solidBuild) {
    if (solidBuild.status === 'solid_ready') {
      addEvent('solid_ready', {
        stlFileUrl: solidBuild.stlFileUrl,
        stlFileSizeBytes: solidBuild.stlFileSizeBytes,
        executionTimeMs: solidBuild.executionTimeMs,
        meshCheck: solidBuild.meshCheck,
      });
    } else if (solidBuild.status === 'solid_failed') {
      addEvent('solid_failed', { errorReason: solidBuild.errorReason });
    } else {
      addEvent('solid_building', { status: solidBuild.status });
    }
  }

  if (gen.status === 'failed') {
    addEvent('failed', { errorContext: gen.errorContext });
  } else if (gen.status === 'ready') {
    addEvent('ready', { buildMetadata: gen.buildMetadata });
  }

  return {
    generationId,
    status: gen.status,
    prompt: gen.prompt,
    events,
  };
}

module.exports = { getProjectHistory, getGenerationTimeline };
