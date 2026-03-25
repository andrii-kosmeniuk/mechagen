'use strict';

/**
 * Workspace Handler — Phase 4
 *
 * GET    /api/workspaces              — list user's workspaces
 * POST   /api/workspaces              — create workspace
 * GET    /api/workspaces/:id          — get workspace
 * PATCH  /api/workspaces/:id          — update workspace (owner/admin)
 * DELETE /api/workspaces/:id          — delete workspace (owner only)
 * GET    /api/workspaces/:id/members  — list members
 * POST   /api/workspaces/:id/members  — add member (admin+)
 * PATCH  /api/workspaces/:id/members/:uid  — change role (admin+)
 * DELETE /api/workspaces/:id/members/:uid  — remove member (admin+)
 */

const ws = require('../services/workspaceService');
const { getUserPlanCode } = require('../services/subscriptionService');
const { canPlanDo }       = require('../services/planService');

function listMyWorkspaces(req, res) {
  const workspaces = ws.getUserWorkspaces(req.user.id);
  return res.json({ workspaces });
}

function createWorkspace(req, res) {
  const userId   = req.user.id;
  const planCode = getUserPlanCode(userId);

  // Team workspace gated to Team plan
  if (!canPlanDo(planCode, 'teamWorkspace') && ws.getUserWorkspaces(userId).length >= 1) {
    return res.status(403).json({
      error:           'Your plan only supports 1 personal workspace. Upgrade to Team to create team workspaces.',
      code:            'FEATURE_NOT_IN_PLAN',
      upgradeRequired: true,
    });
  }

  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required', code: 'MISSING_NAME' });

  try {
    const workspace = ws.createWorkspace({ name, description, ownerUserId: userId });
    return res.status(201).json({ workspace });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getWorkspace(req, res) {
  const workspace = ws.getWorkspace(req.params.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' });
  if (!ws.isMember(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of this workspace', code: 'NOT_MEMBER' });
  }
  const members = ws.getMembers(req.params.id);
  return res.json({ workspace, members });
}

function updateWorkspace(req, res) {
  try {
    ws.requireRole(req.params.id, req.user.id, 'admin');
    const updated = ws.updateWorkspace(req.params.id, req.body);
    return res.json({ workspace: updated });
  } catch (err) { return res.status(err.status || 500).json({ error: err.message, code: err.code }); }
}

function deleteWorkspace(req, res) {
  try {
    ws.requireRole(req.params.id, req.user.id, 'owner');
    ws.deleteWorkspace(req.params.id);
    return res.status(204).end();
  } catch (err) { return res.status(err.status || 500).json({ error: err.message, code: err.code }); }
}

function listMembers(req, res) {
  try {
    ws.requireRole(req.params.id, req.user.id, 'viewer');
    return res.json({ members: ws.getMembers(req.params.id) });
  } catch (err) { return res.status(err.status || 403).json({ error: err.message, code: err.code }); }
}

function addMember(req, res) {
  try {
    ws.requireRole(req.params.id, req.user.id, 'admin');
    const { userId, role = 'member' } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required', code: 'MISSING_USER_ID' });
    const member = ws.addMember(req.params.id, userId, role);
    return res.status(201).json({ member });
  } catch (err) { return res.status(err.status || 500).json({ error: err.message, code: err.code }); }
}

function updateMemberRole(req, res) {
  try {
    ws.requireRole(req.params.id, req.user.id, 'admin');
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required', code: 'MISSING_ROLE' });
    const member = ws.updateMemberRole(req.params.id, req.params.uid, role);
    return res.json({ member });
  } catch (err) { return res.status(err.status || 500).json({ error: err.message, code: err.code }); }
}

function removeMember(req, res) {
  try {
    ws.requireRole(req.params.id, req.user.id, 'admin');
    ws.removeMember(req.params.id, req.params.uid);
    return res.status(204).end();
  } catch (err) { return res.status(err.status || 500).json({ error: err.message, code: err.code }); }
}

module.exports = {
  listMyWorkspaces, createWorkspace, getWorkspace, updateWorkspace, deleteWorkspace,
  listMembers, addMember, updateMemberRole, removeMember,
};
