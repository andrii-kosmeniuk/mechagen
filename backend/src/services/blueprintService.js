'use strict';

/**
 * Blueprint Service — Phase 2
 *
 * Handles in-memory blueprint storage (drop-in for Supabase Storage).
 * Files are saved to disk at uploads/ for MVP.
 */

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_TYPES = {
  'image/png':      { ext: 'png',  previewable: true },
  'image/jpeg':     { ext: 'jpg',  previewable: true },
  'image/jpg':      { ext: 'jpg',  previewable: true },
  'image/webp':     { ext: 'webp', previewable: true },
  'application/pdf':{ ext: 'pdf',  previewable: false },
};

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** In-memory store: blueprintId → BlueprintRecord */
const blueprintStore = new Map();

/**
 * @typedef {object} BlueprintRecord
 * @property {string} id
 * @property {string} projectId
 * @property {string|null} generationId
 * @property {string} fileName
 * @property {string} fileType          mime type
 * @property {number} fileSize
 * @property {string} filePath          absolute path on disk
 * @property {string} fileUrl           relative URL served by static handler
 * @property {boolean} previewable      true if image (png/jpg/webp)
 * @property {object|null} analysisJson blueprint analysis result
 * @property {string} createdAt
 */

/**
 * Validate a raw file upload.
 * @param {{ originalName: string, mimeType: string, sizeBytes: number }} meta
 * @returns {string|null} error message or null if valid
 */
function validateBlueprint({ mimeType, sizeBytes }) {
  if (!ALLOWED_TYPES[mimeType]) {
    return `Unsupported file type "${mimeType}". Allowed: PNG, JPG, WEBP, PDF.`;
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return `File too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`;
  }
  return null;
}

/**
 * Save a file buffer to disk and create a blueprint record.
 * @param {{ buffer: Buffer, originalName: string, mimeType: string, projectId: string }} opts
 * @returns {BlueprintRecord}
 */
function saveBlueprint({ buffer, originalName, mimeType, projectId }) {
  const err = validateBlueprint({ mimeType, sizeBytes: buffer.length });
  if (err) throw Object.assign(new Error(err), { status: 400 });

  const id  = randomUUID();
  const ext = ALLOWED_TYPES[mimeType]?.ext || 'bin';
  const safeName = `${id}.${ext}`;
  const filePath  = path.join(UPLOADS_DIR, safeName);

  fs.writeFileSync(filePath, buffer);

  const record = {
    id,
    projectId: projectId || 'default-project',
    generationId: null,
    fileName: originalName.replace(/[^a-z0-9._-]/gi, '_').slice(0, 120),
    fileType: mimeType,
    fileSize: buffer.length,
    filePath,
    fileUrl: `/uploads/${safeName}`,
    previewable: ALLOWED_TYPES[mimeType]?.previewable ?? false,
    analysisJson: null,
    createdAt: new Date().toISOString(),
  };

  blueprintStore.set(id, record);
  console.log(`[blueprint] saved ${id} (${(buffer.length / 1024).toFixed(0)} KB, ${mimeType})`);
  return record;
}

/**
 * Retrieve a blueprint record.
 */
function getBlueprint(id) {
  return blueprintStore.get(id) ?? null;
}

/**
 * Attach analysis JSON to a blueprint record.
 */
function setBlueprintAnalysis(id, analysisJson) {
  const existing = blueprintStore.get(id);
  if (!existing) throw Object.assign(new Error(`Blueprint ${id} not found`), { status: 404 });
  const updated = { ...existing, analysisJson };
  blueprintStore.set(id, updated);
  return updated;
}

/**
 * Link a generation to a blueprint.
 */
function linkBlueprintToGeneration(blueprintId, generationId) {
  const rec = blueprintStore.get(blueprintId);
  if (rec) {
    blueprintStore.set(blueprintId, { ...rec, generationId });
  }
}

/**
 * Get all blueprints for a project.
 */
function listBlueprintsForProject(projectId) {
  return Array.from(blueprintStore.values())
    .filter(b => b.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Read a blueprint file as a Buffer (needed for base64 encoding for AI).
 */
function readBlueprintFile(id) {
  const rec = getBlueprint(id);
  if (!rec) throw Object.assign(new Error(`Blueprint ${id} not found`), { status: 404 });
  return fs.readFileSync(rec.filePath);
}

module.exports = {
  validateBlueprint,
  saveBlueprint,
  getBlueprint,
  setBlueprintAnalysis,
  linkBlueprintToGeneration,
  listBlueprintsForProject,
  readBlueprintFile,
  ALLOWED_TYPES,
  MAX_FILE_BYTES,
};
