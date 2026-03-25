'use strict';

/**
 * Catalog Routes
 * GET /api/catalog/part-types
 */

const catalogHandler = require('../api/catalog');

async function handle(req, res, _rawRes, url) {
  if (url.pathname === '/api/catalog/part-types' && req.method === 'GET') {
    await catalogHandler(req, res);
    return true;
  }
  return false;
}

module.exports = { handle };
