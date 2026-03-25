'use strict';

/**
 * GET /api/generations/:id
 * Returns the full generation record with current pipeline status.
 *
 * POST /api/generations/:id/repair
 * Triggers repair if validation failed.
 */

const { getGeneration, triggerRepair } = require('../services/orchestration');

async function getGenerationHandler(req, res, id) {
  const gen = getGeneration(id);
  if (!gen) {
    return res.status(404).json({ error: `Generation ${id} not found` });
  }
  return res.status(200).json(gen);
}

async function repairHandler(req, res, id) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  try {
    const updated = await triggerRepair(id);
    return res.status(200).json(updated);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = { getGenerationHandler, repairHandler };
