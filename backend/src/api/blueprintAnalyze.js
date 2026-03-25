'use strict';

/**
 * POST /api/blueprints/:id/analyze
 * GET  /api/blueprints/:id
 */

const { analyzeBlueprintById } = require('../services/blueprintAnalysis');
const { getBlueprint }          = require('../services/blueprintService');

async function analyzeHandler(req, res) {
  const { id } = req.params;
  try {
    const analysis = await analyzeBlueprintById(id);
    res.json({ blueprintId: id, analysis });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

function getHandler(req, res) {
  const { id } = req.params;
  const blueprint = getBlueprint(id);
  if (!blueprint) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(blueprint);
}

module.exports = { analyzeHandler, getHandler };
