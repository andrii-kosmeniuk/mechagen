'use strict';

/**
 * POST /api/blueprints/upload
 *
 * Accepts multipart/form-data with a single "file" field.
 * Uses busboy for streaming parsing (no disk temp file needed).
 */

const Busboy = require('busboy');
const { saveBlueprint } = require('../services/blueprintService');

module.exports = function blueprintUploadHandler(req, res) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return res.status(400).json({ error: 'Expected multipart/form-data' });
  }

  let busboy;
  try {
    busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 11 * 1024 * 1024 } });
  } catch (e) {
    return res.status(400).json({ error: 'Invalid multipart request' });
  }

  let projectId = 'default-project';
  const fields  = {};
  let fileHandled = false;
  let responded   = false;

  busboy.on('field', (name, val) => { fields[name] = val; });

  busboy.on('file', (fieldname, fileStream, info) => {
    if (fileHandled) { fileStream.resume(); return; }
    fileHandled = true;

    const { filename, mimeType } = info;
    const chunks = [];

    fileStream.on('data', chunk => chunks.push(chunk));
    fileStream.on('limit', () => {
      if (!responded) {
        responded = true;
        res.status(400).json({ error: 'File too large — maximum 10 MB' });
      }
    });
    fileStream.on('end', () => {
      if (responded) return;
      const buffer = Buffer.concat(chunks);
      projectId = fields.projectId || 'default-project';

      try {
        const record = saveBlueprint({ buffer, originalName: filename, mimeType, projectId });
        responded = true;
        res.json({
          id:         record.id,
          fileName:   record.fileName,
          fileType:   record.fileType,
          fileSize:   record.fileSize,
          fileUrl:    record.fileUrl,
          previewable: record.previewable,
          createdAt:  record.createdAt,
        });
      } catch (err) {
        responded = true;
        res.status(err.status || 400).json({ error: err.message });
      }
    });
  });

  busboy.on('finish', () => {
    if (!responded) {
      responded = true;
      res.status(400).json({ error: 'No file found in the upload' });
    }
  });

  busboy.on('error', (err) => {
    if (!responded) {
      responded = true;
      res.status(400).json({ error: `Upload parsing error: ${err.message}` });
    }
  });

  req.pipe(busboy);
};
