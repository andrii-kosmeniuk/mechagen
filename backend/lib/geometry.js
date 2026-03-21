'use strict';

const VALID_SHAPES = new Set(['box', 'cylinder', 'sphere', 'torus', 'cone']);

const REQUIRED_PARAMS = {
  box:      ['w', 'h', 'd'],
  cylinder: ['r', 'h'],
  sphere:   ['r'],
  torus:    ['r', 'tube'],
  cone:     ['r', 'h'],
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isUnitFloat(v) {
  return isFiniteNumber(v) && v >= 0 && v <= 1;
}

function isNormalizedCoord(v) {
  return isFiniteNumber(v) && v >= -3 && v <= 3; // slight tolerance over -2..2
}

function validateVector3(obj, path) {
  if (!obj || typeof obj !== 'object') return [`${path} must be an object`];
  const errors = [];
  for (const axis of ['x', 'y', 'z']) {
    if (!isFiniteNumber(obj[axis])) errors.push(`${path}.${axis} must be a finite number`);
  }
  return errors;
}

function validatePart(part, index) {
  const errors = [];
  const base = `parts[${index}]`;

  if (!VALID_SHAPES.has(part.shape)) {
    errors.push(`${base}.shape "${part.shape}" is not valid`);
  } else {
    const required = REQUIRED_PARAMS[part.shape];
    for (const key of required) {
      if (!isFiniteNumber(part.params?.[key])) {
        errors.push(`${base}.params.${key} must be a finite number`);
      }
    }
  }

  errors.push(...validateVector3(part.position, `${base}.position`));
  errors.push(...validateVector3(part.rotation, `${base}.rotation`));

  if (!HEX_COLOR.test(part.color ?? '')) {
    errors.push(`${base}.color must be a valid hex color like #8a9aaa`);
  }
  if (!isUnitFloat(part.metalness)) {
    errors.push(`${base}.metalness must be a number between 0 and 1`);
  }
  if (!isUnitFloat(part.roughness)) {
    errors.push(`${base}.roughness must be a number between 0 and 1`);
  }

  return errors;
}

/**
 * Validates the geometry object returned by the AI.
 * Returns [] on success or string[] of errors on failure.
 */
function validateGeometry(data) {
  if (!data || typeof data !== 'object') return ['Response is not a JSON object'];

  const errors = [];

  if (data.type !== 'compound') errors.push('type must be "compound"');
  if (typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (typeof data.description !== 'string') errors.push('description must be a string');

  errors.push(...validateVector3(data.dimensions, 'dimensions'));

  if (!Array.isArray(data.parts)) {
    errors.push('parts must be an array');
  } else if (data.parts.length < 1) {
    errors.push('parts must contain at least 1 shape');
  } else if (data.parts.length > 10) {
    errors.push('parts must not exceed 10 shapes');
  } else {
    for (let i = 0; i < data.parts.length; i++) {
      errors.push(...validatePart(data.parts[i], i));
    }
  }

  return errors;
}

/**
 * Strips all AI noise from the raw response text and returns the raw JS code.
 * Returns { code: string } or throws Error.
 */
function parseGeometryResponse(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Model returned an empty response');
  }

  let clean = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // strip reasoning traces
    .replace(/^```(?:javascript|js|jscad)?\s*/im, '') // strip opening fence
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')                  // strip closing fence
    .trim();

  // Strip any preamble/explanation text before the actual JS code starts.
  // The JSCAD mandatory block always starts with 'const {' or 'function main'
  const codeStart = clean.search(/const\s*\{|function\s+main\s*\(/);
  if (codeStart > 0) {
    clean = clean.slice(codeStart);
  }

  if (!clean || clean.length < 20) {
    throw new Error('Model returned no executable code');
  }

  return { code: clean };
}

module.exports = { parseGeometryResponse, validateGeometry };
