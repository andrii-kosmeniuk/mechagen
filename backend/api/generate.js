'use strict';

const { executeGenerate } = require('../lib/executeGenerate');

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

  try {
    const out = await executeGenerate(req.body);
    return res.status(200).json({
      stl: out.stl,
      code: out.code,
      name: out.name,
      parts: out.parts,
      description: out.description,
      dimensions: out.dimensions,
    });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[generate]', err.message);
    return sendError(res, status, err.message);
  }
};
