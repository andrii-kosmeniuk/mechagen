'use strict';

/**
 * Upload Guard Middleware — MechaGen
 *
 * Validates multipart file uploads before they are processed.
 * Checks: file type (MIME), file size, filename safety.
 *
 * Usage (in blueprintUpload.js):
 *   const { assertUploadSafe } = require('../middleware/uploadGuard');
 *   assertUploadSafe(filename, mimeType, sizeBytes); // throws AppError if invalid
 */

const path = require('path');
const { AppError } = require('../errors/AppError');
const { E }        = require('../errors/errorCodes');

// ── Config ─────────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pdf']);

const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || String(10 * 1024 * 1024), 10); // 10 MB

// ── Validators ─────────────────────────────────────────────────────────────────

/**
 * Assert a file upload is safe to process.
 * Throws AppError(400) on violation.
 *
 * @param {string} filename      Original filename from multipart
 * @param {string} mimeType      MIME type reported by client
 * @param {number} sizeBytes     File size in bytes
 */
function assertUploadSafe(filename, mimeType, sizeBytes) {
  // 1. Filename must be a plain string
  if (!filename || typeof filename !== 'string') {
    throw new AppError('Invalid filename', 400, E.BLUEPRINT_UPLOAD_FAILED);
  }

  // 2. Sanitize: no path traversal
  const basename = path.basename(filename);
  if (basename !== filename.replace(/[/\\]/g, '')) {
    throw new AppError('Filename contains path traversal characters', 400, E.BLUEPRINT_UPLOAD_FAILED);
  }

  // 3. Extension must be allowed
  const ext = path.extname(basename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new AppError(
      `File type not allowed: ${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      400,
      E.BLUEPRINT_UPLOAD_FAILED
    );
  }

  // 4. MIME type must be allowed (secondary check — not trusted alone, client can lie)
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())) {
    throw new AppError(
      `MIME type not allowed: ${mimeType}`,
      400,
      E.BLUEPRINT_UPLOAD_FAILED
    );
  }

  // 5. Size limit
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      `File too large: ${Math.round(sizeBytes / 1024)}KB exceeds limit of ${Math.round(MAX_FILE_SIZE_BYTES / 1024)}KB`,
      400,
      E.BLUEPRINT_UPLOAD_FAILED
    );
  }
}

/**
 * Check upload safety without throwing — returns null on success or an error message.
 */
function checkUploadSafe(filename, mimeType, sizeBytes) {
  try {
    assertUploadSafe(filename, mimeType, sizeBytes);
    return null;
  } catch (err) {
    return err.message;
  }
}

module.exports = {
  assertUploadSafe,
  checkUploadSafe,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
};
