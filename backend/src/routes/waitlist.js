'use strict';

/**
 * Waitlist Routes
 * POST /api/waitlist        (public)
 * GET  /api/waitlist/status (public)
 */

const { submitWaitlist, checkWaitlistStatus } = require('../api/waitlistHandler');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/waitlist' && method === 'POST') {
    req.body = await req._readBody().catch(() => ({}));
    await submitWaitlist(req, res);
    return true;
  }

  if (pathname === '/api/waitlist/status' && method === 'GET') {
    await checkWaitlistStatus(req, res);
    return true;
  }

  return false;
}

module.exports = { handle };
