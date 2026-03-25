'use strict';

/**
 * GET /api/generations/:id/export/status
 * GET /api/generations/:id/export/obj
 * GET /api/generations/:id/export/glb
 */

const path = require('path');
const fs   = require('fs');
const { getGeneration } = require('../services/orchestration');
const {
  checkExportReadiness,
  exportGenerationToObj,
  exportGenerationToGlb,
  getExportsForGeneration,
} = require('../services/exportService');
const { getSolidBuildByGenerationId } = require('../services/solidBuildService');
const { checkStlExportReadiness }     = require('../services/solidValidationService');

function statusHandler(req, res) {
  const gen = getGeneration(req.params.id);
  if (!gen) return res.status(404).json({ error: 'Generation not found' });
  const readiness = checkExportReadiness(gen);
  const exports   = getExportsForGeneration(req.params.id);
  res.json({ ...readiness, exports });
}

async function objHandler(req, res) {
  const gen = getGeneration(req.params.id);
  if (!gen) return res.status(404).json({ error: 'Generation not found' });
  try {
    const record = exportGenerationToObj(gen);
    res.setHeader('Content-Type', 'model/obj');
    res.setHeader('Content-Disposition', `attachment; filename="${record.fileName}"`);
    res.send(fs.readFileSync(record.filePath));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function glbHandler(req, res) {
  const gen = getGeneration(req.params.id);
  if (!gen) return res.status(404).json({ error: 'Generation not found' });
  try {
    const record = exportGenerationToGlb(gen);
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `attachment; filename="${record.fileName}"`);
    res.send(fs.readFileSync(record.filePath));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function stlHandler(req, res) {
  const genId = req.params.id;
  const gen   = getGeneration(genId);
  if (!gen) return res.status(404).json({ error: 'Generation not found' });

  const solidBuild = getSolidBuildByGenerationId(genId);
  const readiness  = checkStlExportReadiness(solidBuild);
  if (!readiness.canExport) {
    return res.status(400).json({ error: readiness.reason });
  }

  try {
    const partName = (gen.specJson?.partType || 'part').replace(/_/g, '_');
    const fileName = `${partName}_${genId.slice(0, 8)}.stl`;
    const filePath = solidBuild.stlFilePath;
    const fileStat = fs.statSync(filePath);

    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileStat.size);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { statusHandler, objHandler, glbHandler, stlHandler };
