'use strict';

/**
 * Feedback Routes
 * POST /api/feedback   (auth optional)
 */

const { submitFeedbackHandler } = require('../api/feedbackHandler');
const { authMiddleware } = require('../middleware/auth');

async function handle(req, res, _rawRes, url) {
  if (url.pathname === '/api/feedback' && req.method === 'POST') {
    req.body = await req._readBody().catch(() => ({}));
    // Auth is optional — try silently, don't block
    try { await new Promise(r => authMiddleware(req, res, r)); } catch { req.user = null; }
    await submitFeedbackHandler(req, res);
    return true;
  }
  return false;
}

module.exports = { handle };
