'use strict';

/**
 * POST /api/pipeline/generate
 * Starts the full structured pipeline. Returns { jobId, status: 'queued' } immediately.
 *
 * Request body:
 * {
 *   prompt: string,
 *   context?: string,
 *   projectName?: string,
 *   manufacturingMode?: '3d_print' | 'cnc' | 'sheet_metal' | 'unknown',
 *   materialPreference?: string,
 *   highDetail?: boolean,
 *   image?: string  // base64
 * }
 */

const { startGeneration } = require('../services/orchestration');
const { CANONICAL_PART_TYPES } = require('../schemas/specSchema');

const MAX_PROMPT_LEN = 2000;
const MAX_IMAGE_LEN  = 5 * 1024 * 1024; // 5MB base64

module.exports = async function pipelineGenerateHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const body = req.body || {};
  const prompt = (body.prompt || '').toString().trim();

  if (!prompt && !body.image) {
    return res.status(400).json({ error: 'prompt or image is required' });
  }
  if (prompt.length > MAX_PROMPT_LEN) {
    return res.status(400).json({ error: `Prompt too long (max ${MAX_PROMPT_LEN} chars)` });
  }
  if (body.image && body.image.length > MAX_IMAGE_LEN) {
    return res.status(400).json({ error: 'Image too large (max 5MB base64)' });
  }

  const allowed = ['3d_print', 'cnc', 'sheet_metal', 'unknown'];
  const mfgMode = allowed.includes(body.manufacturingMode) ? body.manufacturingMode : 'unknown';

  const { jobId, status } = startGeneration({
    prompt,
    context:             (body.context || '').toString().trim() || undefined,
    image:               body.image || undefined,
    projectName:         (body.projectName || '').toString().trim() || undefined,
    manufacturingMode:   mfgMode,
    materialPreference:  (body.materialPreference || '').toString().trim() || undefined,
    highDetail:          !!body.highDetail,
    projectId:           (body.projectId || 'default-project').toString(),
  });

  return res.status(202).json({ jobId, status });
};
