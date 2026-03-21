'use strict';

const { sanitizeRequest }     = require('../lib/sanitize');
const { callNemotron }        = require('../lib/ai');
const { parseGeometryResponse } = require('../lib/geometry');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCors(res) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return sendError(res, 405, 'POST only');

  // 1. Validate input
  const { value: input, error, status } = sanitizeRequest(req.body);
  if (error) return sendError(res, status, error);

  // 2. Call AI
  let raw;
  try {
    raw = await callNemotron(input.prompt, input.image);
  } catch (err) {
    console.error('[generate] AI call failed:', err.message);
    return sendError(res, err.status ?? 500, err.message);
  }

  // 3. Parse and validate geometry
  let geometry;
  try {
    geometry = parseGeometryResponse(raw);
  } catch (err) {
    if (err.validationErrors) {
      console.error('[generate] Geometry validation:', err.validationErrors);
    } else {
      console.error('[generate] Parse failed:', err.message);
    }
    if (err instanceof SyntaxError) {
      return sendError(res, 502, 'Model returned invalid JSON — please try again');
    }
    return sendError(res, 502, err.message || 'Model returned invalid geometry');
  }

  // 4. Respond
  return res.status(200).json(geometry);
};
