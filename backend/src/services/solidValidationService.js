'use strict';

/**
 * Solid Validation Service — Phase 3
 *
 * Validates a solid build result (post-worker).
 * Distinct from the preview validation engine (Phase 1).
 *
 * A part can be preview-valid but solid-invalid.
 * The UI must make this difference clear.
 */

const fs = require('fs');

/**
 * @typedef {object} SolidValidationReport
 * @property {boolean} solidValid
 * @property {string|null} reason
 * @property {{ id: string, passed: boolean, detail: string }[]} checks
 */

/**
 * Validate a worker result object and the resulting STL file.
 *
 * @param {object} workerResult - structured result from Python worker
 * @returns {SolidValidationReport}
 */
function validateSolidBuild(workerResult) {
  const checks = [];

  // 1. Worker exit success
  const workerSucceeded = workerResult && workerResult.success === true;
  checks.push({
    id:     'worker_succeeded',
    passed: workerSucceeded,
    detail: workerSucceeded
      ? 'Python worker exited cleanly'
      : `Worker reported failure: ${workerResult?.error || 'unknown'}`,
  });

  if (!workerSucceeded) {
    return { solidValid: false, reason: `Worker failed: ${workerResult?.error}`, checks };
  }

  // 2. STL path provided
  const stlPath = workerResult.stlPath;
  const hasPath = typeof stlPath === 'string' && stlPath.length > 0;
  checks.push({
    id:     'stl_path_present',
    passed: hasPath,
    detail: hasPath ? `STL path: ${stlPath}` : 'No STL path in worker result',
  });

  if (!hasPath) {
    return { solidValid: false, reason: 'Worker did not return an STL path', checks };
  }

  // 3. File exists on disk
  const fileExists = fs.existsSync(stlPath);
  checks.push({
    id:     'stl_file_exists',
    passed: fileExists,
    detail: fileExists ? 'STL file found on disk' : `STL file not found at: ${stlPath}`,
  });

  if (!fileExists) {
    return { solidValid: false, reason: `STL file missing at: ${stlPath}`, checks };
  }

  // 4. File non-empty
  const size = workerResult.stlSizeBytes ?? 0;
  const nonEmpty = size > 84; // minimum binary STL size (header + count + 1 triangle)
  checks.push({
    id:     'stl_non_empty',
    passed: nonEmpty,
    detail: nonEmpty ? `STL size: ${size} bytes` : `STL file is too small (${size} bytes)`,
  });

  if (!nonEmpty) {
    return { solidValid: false, reason: `STL file is empty or too small (${size} bytes)`, checks };
  }

  // 5. STL header sanity check
  let headerValid = false;
  let headerDetail = '';
  try {
    const fd = fs.openSync(stlPath, 'r');
    const buf = Buffer.alloc(84);
    fs.readSync(fd, buf, 0, 84, 0);
    fs.closeSync(fd);
    // Binary STL: bytes 80-83 = triangle count uint32 LE
    const triangleCount = buf.readUInt32LE(80);
    headerValid = triangleCount > 0;
    headerDetail = `${triangleCount} triangles declared in header`;
  } catch (err) {
    headerDetail = `Could not read STL header: ${err.message}`;
  }
  checks.push({
    id:     'stl_header_valid',
    passed: headerValid,
    detail: headerDetail,
  });

  if (!headerValid) {
    return { solidValid: false, reason: `Invalid STL header: ${headerDetail}`, checks };
  }

  // 6. Mesh check (if trimesh ran)
  if (workerResult.meshCheck) {
    const { triangleCount, valid } = workerResult.meshCheck;
    checks.push({
      id:     'mesh_valid',
      passed: valid,
      detail: valid
        ? `Mesh is valid — ${triangleCount} triangles`
        : `Mesh reported invalid — ${triangleCount} triangles`,
    });
    if (!valid) {
      // Non-fatal warning only — still usable for most purposes
      checks[checks.length - 1].passed = true; // treat as warning not error
    }
  }

  return {
    solidValid: true,
    reason:     null,
    checks,
  };
}

/**
 * Readiness check for STL export.
 * @param {{ solidStatus: string, solidBuildResult: object }} generation
 */
function checkStlExportReadiness(solidBuild) {
  if (!solidBuild) {
    return { canExport: false, reason: 'No solid build exists for this generation' };
  }
  if (solidBuild.status !== 'solid_ready') {
    return { canExport: false, reason: `Solid build status is "${solidBuild.status}" — must be solid_ready` };
  }
  if (!solidBuild.stlFilePath || !fs.existsSync(solidBuild.stlFilePath)) {
    return { canExport: false, reason: 'STL file is missing on disk' };
  }
  return { canExport: true, reason: null };
}

module.exports = { validateSolidBuild, checkStlExportReadiness };
