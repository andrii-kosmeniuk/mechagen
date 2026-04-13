'use strict';

/**
 * GET /api/projects/:projectId/history
 * GET /api/generations/:id/timeline
 */

const { getProjectHistory, getGenerationTimeline } = require('../services/historyService');

function projectHistoryHandler(req, res) {
  const { projectId } = req.params;
  try {
    const history = getProjectHistory(projectId);
    res.json(history);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

function generationTimelineHandler(req, res) {
  const { id } = req.params;
  try {
    const timeline = getGenerationTimeline(id);
    if (!timeline) return res.status(404).json({ error: 'Generation not found' });
    res.json(timeline);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { projectHistoryHandler, generationTimelineHandler };
