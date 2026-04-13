'use strict';

/**
 * Solid Build API Handler — Phase 3
 *
 * POST /api/generations/:id/solid/start  — trigger solid build
 * GET  /api/generations/:id/solid/status — poll build state
 */

const { startSolidBuild, getSolidBuildByGenerationId } = require('../services/solidBuildService');
const { getGeneration, updateGeneration } = require('../services/orchestration');

async function solidStartHandler(req, res) {
  try {
    const genId = req.params?.id;
    if (!genId) return res.status(400).json({ error: 'Missing generation id' });

    const generation = getGeneration(genId);
    if (!generation) return res.status(404).json({ error: 'Generation not found' });

    // Check if a solid build is already in progress
    const existing = getSolidBuildByGenerationId(genId);
    if (existing && ['building_solid', 'translating_solid', 'solid_validating'].includes(existing.status)) {
      return res.status(409).json({
        error: `Solid build already in progress (status: ${existing.status})`,
        buildId: existing.id,
      });
    }

    const timeoutMs = parseInt(req.body?.timeoutMs || process.env.CADQUERY_TIMEOUT_MS || '60000', 10);

    // Mark generation as having requested solid
    updateGeneration(genId, {
      solidRequested: true,
      solidStatus:    'building_solid',
    });

    const { buildId, status } = await startSolidBuild(generation, { timeoutMs });

    return res.status(202).json({ buildId, status, generationId: genId });
  } catch (err) {
    console.error('[solidStart]', err.message);
    return res.status(err.status || 500).json({ error: err.message });
  }
}

async function solidStatusHandler(req, res) {
  try {
    const genId = req.params?.id;
    if (!genId) return res.status(400).json({ error: 'Missing generation id' });

    const solidBuild = getSolidBuildByGenerationId(genId);
    if (!solidBuild) {
      return res.status(200).json({
        solidBuild:    null,
        solidStatus:   'not_started',
        generationId:  genId,
      });
    }

    // Sync solidStatus back to generation record
    const generation = getGeneration(genId);
    if (generation && generation.solidStatus !== solidBuild.status) {
      updateGeneration(genId, { solidStatus: solidBuild.status });
    }

    return res.status(200).json({
      solidBuild: {
        id:               solidBuild.id,
        status:           solidBuild.status,
        generationId:     solidBuild.generationId,
        executionTimeMs:  solidBuild.executionTimeMs,
        stlFileUrl:       solidBuild.stlFileUrl,
        stlFileSizeBytes: solidBuild.stlFileSizeBytes,
        meshCheck:        solidBuild.meshCheck,
        errorReason:      solidBuild.errorReason,
        validationJson:   solidBuild.validationJson,
        createdAt:        solidBuild.createdAt,
        updatedAt:        solidBuild.updatedAt,
      },
      solidStatus:  solidBuild.status,
      generationId: genId,
    });
  } catch (err) {
    console.error('[solidStatus]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { solidStartHandler, solidStatusHandler };
