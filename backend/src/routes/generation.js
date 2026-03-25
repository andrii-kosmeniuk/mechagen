'use strict';

/**
 * Generation Routes
 * POST /api/generate
 * POST /api/ai/chat
 * POST /api/pipeline/generate
 * GET  /api/generations/:id
 * POST /api/generations/:id/repair
 * GET  /api/generations/:id/timeline
 * GET  /api/projects/:projectId/history
 */

const generateHandler     = require('../../api/generate');
const chatHandler         = require('../../api/ai/chat');
const { pipelineGenerate } = require('../api/pipelineGenerate');
const { getGenerationHandler, repairHandler } = require('../api/generations');
const { projectHistoryHandler, generationTimelineHandler } = require('../api/historyHandler');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/generate' && method === 'POST') {
    try { req.body = await req._readBody(); } catch { res.status(400).json({ error: 'Invalid JSON body' }); return true; }
    await generateHandler(req, res);
    return true;
  }

  if (pathname === '/api/ai/chat' && method === 'POST') {
    try { req.body = await req._readBody(); } catch { res.status(400).json({ error: 'Invalid JSON body' }); return true; }
    await chatHandler(req, res);
    return true;
  }

  if (pathname === '/api/pipeline/generate' && method === 'POST') {
    try { req.body = await req._readBody(); } catch { res.status(400).json({ error: 'Invalid JSON body' }); return true; }
    const handler = typeof pipelineGenerate === 'function' ? pipelineGenerate : require('../api/pipelineGenerate');
    await (typeof handler === 'function' ? handler : handler.default)(req, res);
    return true;
  }

  const genMatch = pathname.match(/^\/api\/generations\/([^/]+)$/);
  if (genMatch && method === 'GET') {
    req.params = { id: genMatch[1] };
    await getGenerationHandler(req, res, genMatch[1]);
    return true;
  }

  const repairMatch = pathname.match(/^\/api\/generations\/([^/]+)\/repair$/);
  if (repairMatch && method === 'POST') {
    req.params = { id: repairMatch[1] };
    await repairHandler(req, res, repairMatch[1]);
    return true;
  }

  const timelineMatch = pathname.match(/^\/api\/generations\/([^/]+)\/timeline$/);
  if (timelineMatch && method === 'GET') {
    req.params = { id: timelineMatch[1] };
    await generationTimelineHandler(req, res);
    return true;
  }

  const historyMatch = pathname.match(/^\/api\/projects\/([^/]+)\/history$/);
  if (historyMatch && method === 'GET') {
    req.params = { projectId: historyMatch[1] };
    await projectHistoryHandler(req, res);
    return true;
  }

  return false;
}

module.exports = { handle };
