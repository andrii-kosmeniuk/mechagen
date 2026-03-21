'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const { sanitizeRequest } = require('./sanitize');
const { callNemotron } = require('./ai');

/** Detailed procedural JSON (bolts/gears/bearings) — cap matches GEOMETRY_SYSTEM_PROMPT. */
const MAX_PARTS = 60;

/**
 * @param {string} raw
 * @returns {{ name: string, parts: object[], description?: string, dimensions?: object }}
 */
function parseGeomPartsJson(raw) {
  let s = (raw || '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) {
    const e = new Error('Model did not return a JSON object with parts.');
    e.status = 502;
    throw e;
  }
  s = s.slice(start, end + 1);
  let obj;
  try {
    obj = JSON.parse(s);
  } catch (err) {
    const e = new Error(`Invalid JSON from model: ${err.message}`);
    e.status = 502;
    throw e;
  }
  if (!obj || typeof obj !== 'object') {
    const e = new Error('JSON root must be an object with name and parts.');
    e.status = 502;
    throw e;
  }
  if (!Array.isArray(obj.parts) || obj.parts.length === 0) {
    const e = new Error('JSON must include a non-empty "parts" array.');
    e.status = 502;
    throw e;
  }
  if (obj.parts.length > MAX_PARTS) {
    const e = new Error(`Too many parts (max ${MAX_PARTS}).`);
    e.status = 400;
    throw e;
  }

  const parts = obj.parts.map((pt, idx) => {
    const shape =
      typeof pt.shape === 'string' ? pt.shape.toLowerCase().trim() : 'box';
    const paramsIn = pt.params && typeof pt.params === 'object' ? pt.params : {};
    const params = {};
    for (const k of Object.keys(paramsIn)) {
      const n = Number(paramsIn[k]);
      if (Number.isFinite(n)) params[k] = n;
    }
    const pos = pt.position && typeof pt.position === 'object' ? pt.position : {};
    const rot = pt.rotation && typeof pt.rotation === 'object' ? pt.rotation : {};
    const label =
      typeof pt.label === 'string' && pt.label.trim()
        ? pt.label.trim()
        : `part_${idx + 1}`;
    return {
      shape,
      params,
      position: {
        x: Number(pos.x) || 0,
        y: Number(pos.y) || 0,
        z: Number(pos.z) || 0,
      },
      rotation: {
        x: Number(rot.x) || 0,
        y: Number(rot.y) || 0,
        z: Number(rot.z) || 0,
      },
      color: typeof pt.color === 'string' ? pt.color : '#8a9aaa',
      metalness: Number.isFinite(pt.metalness) ? pt.metalness : 0.85,
      roughness: Number.isFinite(pt.roughness) ? pt.roughness : 0.2,
      label,
    };
  });

  const name =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim()
      : 'Generated part';

  let description;
  if (typeof obj.description === 'string' && obj.description.trim()) {
    description = obj.description.trim();
  }

  let dimensions;
  if (obj.dimensions && typeof obj.dimensions === 'object') {
    const d = obj.dimensions;
    const x = Number(d.x);
    const y = Number(d.y);
    const z = Number(d.z);
    if ([x, y, z].every(n => Number.isFinite(n))) {
      dimensions = { x, y, z };
    }
  }

  return { name, parts, description, dimensions };
}

/**
 * Merge UI fields so project description / name are actually seen by the model.
 */
function buildModelPrompt(input) {
  const chunks = [];
  if (input.projectName) {
    chunks.push(`Part name: ${input.projectName}`);
  }
  if (input.context) {
    chunks.push(
      'Design requirements / constraints (you MUST respect these):\n' + input.context
    );
  }
  if (input.prompt) {
    chunks.push('Geometry to build:\n' + input.prompt);
  }
  return chunks.join('\n\n');
}

/**
 * AI → CadQuery (stdin) → STL file → { stl: base64, code: raw AI text }
 * @param {object} body - Same shape as POST /api/generate JSON body
 * @returns {{ stl?: string, code: string, name?: string, parts?: object[], description?: string, dimensions?: object }}
 */
async function executeGenerate(body) {
  const { value: input, error, status } = sanitizeRequest(body);
  if (error) {
    const e = new Error(error);
    e.status = status;
    throw e;
  }

  const modelPrompt = buildModelPrompt(input);

  if (input.proceduralParts) {
    const raw = await callNemotron(modelPrompt, input.image, {
      highDetail: input.highDetail,
      geometryParts: true,
    });
    const { name, parts, description, dimensions } = parseGeomPartsJson(raw);
    return {
      code: JSON.stringify(
        { name, description, dimensions, parts },
        null,
        2
      ),
      name,
      parts,
      description,
      dimensions,
    };
  }

  const raw = await callNemotron(modelPrompt, input.image, {
    highDetail: input.highDetail,
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mechagen-'));
  const stlPath = path.join(tmpDir, 'output.stl');
  const runnerPath = path.join(__dirname, '..', 'python', 'runner.py');

  const runTimeout = input.highDetail ? 180_000 : 90_000;

  // Bolts, brackets, plates: keep chamfer/fillet (low union count, OCCT handles fine).
  // Bearings, gears: strip (complex unions break OCCT booleans on finish ops).
  const promptLower = (input.prompt || '').toLowerCase();
  const keepFinish =
    /\b(bolt|screw|nut|fastener|bracket|plate|flange|mount|washer)\b/.test(promptLower) &&
    !/\b(bearing|gear|sprocket|ball)\b/.test(promptLower);

  try {
    execSync(`python3 "${runnerPath}" "${stlPath}"`, {
      input: raw,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: runTimeout,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        MECHAGEN_HIGH_DETAIL: input.highDetail ? '1' : '0',
        MECHAGEN_KEEP_FINISH_OPS: keepFinish ? '1' : '0',
      },
    });
    const stlBuffer = fs.readFileSync(stlPath);
    const stl = stlBuffer.toString('base64');
    return { stl, code: raw, name: undefined, parts: undefined };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stderrTail = stderr.trim().split('\n').slice(-12).join('\n');
    console.error('[executeGenerate] CadQuery run failed:\n', stderrTail || err.message);
    const e = new Error(
      'Failed to generate 3D model. CadQuery run failed. ' +
        (stderrTail
          ? `Python said:\n${stderrTail}`
          : 'Ensure CadQuery is installed (`pip install cadquery`) and the model returned valid Python.')
    );
    e.status = 502;
    e.detail = stderrTail;
    throw e;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) { /* ignore */ }
  }
}

module.exports = { executeGenerate };
