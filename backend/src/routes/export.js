'use strict';

/**
 * Export Routes
 * GET /api/generations/:id/export/status
 * GET /api/generations/:id/export/obj
 * GET /api/generations/:id/export/glb
 * GET /api/generations/:id/export/stl
 */

const { statusHandler, objHandler, glbHandler, stlHandler } = require('../api/exportHandler');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  const exportMatch = pathname.match(/^\/api\/generations\/([^/]+)\/export\/(status|obj|glb|stl)$/);
  if (exportMatch && method === 'GET') {
    req.params = { id: exportMatch[1] };
    switch (exportMatch[2]) {
      case 'status': await statusHandler(req, res); return true;
      case 'obj':    await objHandler(req, res);    return true;
      case 'glb':    await glbHandler(req, res);    return true;
      case 'stl':    await stlHandler(req, res);    return true;
    }
  }

  return false;
}

module.exports = { handle };
