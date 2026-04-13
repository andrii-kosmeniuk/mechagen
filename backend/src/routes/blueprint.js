'use strict';

/**
 * Blueprint Routes
 * POST /api/blueprints/upload
 * GET  /api/blueprints/:id
 * POST /api/blueprints/:id/analyze
 */

const blueprintUploadHandler = require('../api/blueprintUpload');
const { analyzeHandler, getHandler } = require('../api/blueprintAnalyze');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/blueprints/upload' && method === 'POST') {
    req.params = {};
    await blueprintUploadHandler(req, res);
    return true;
  }

  const bpGetMatch = pathname.match(/^\/api\/blueprints\/([^/]+)$/);
  if (bpGetMatch && method === 'GET') {
    req.params = { id: bpGetMatch[1] };
    await getHandler(req, res);
    return true;
  }

  const bpAnalyzeMatch = pathname.match(/^\/api\/blueprints\/([^/]+)\/analyze$/);
  if (bpAnalyzeMatch && method === 'POST') {
    req.params = { id: bpAnalyzeMatch[1] };
    await analyzeHandler(req, res);
    return true;
  }

  return false;
}

module.exports = { handle };
