'use strict';

/**
 * Workspace Service — Phase 4
 *
 * Manages team workspaces, memberships, and roles.
 * In-memory store — same pattern as phases 1–3.
 *
 * Roles (ascending privilege):
 *   viewer → member → admin → owner
 */

const { randomUUID } = require('crypto');

const ROLES = ['viewer', 'member', 'admin', 'owner'];
const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 };

/** workspaceId → workspace record */
const workspaceStore = new Map();

/** workspaceId → Map<userId, { role, joinedAt }> */
const memberStore = new Map();

/** userId → Set<workspaceId> (for fast reverse lookup) */
const userWorkspaces = new Map();

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function createWorkspace({ name, ownerUserId, description = '' }) {
  if (!name || !ownerUserId) throw Object.assign(new Error('name and ownerUserId are required'), { status: 400 });

  const id  = randomUUID();
  const now = new Date().toISOString();
  const workspace = {
    id,
    name:        name.trim(),
    description: description.trim(),
    ownerUserId,
    createdAt:   now,
    updatedAt:   now,
  };
  workspaceStore.set(id, workspace);
  memberStore.set(id, new Map());
  _addMember(id, ownerUserId, 'owner');
  return workspace;
}

function getWorkspace(workspaceId) {
  return workspaceStore.get(workspaceId) || null;
}

function updateWorkspace(workspaceId, { name, description }) {
  const ws = workspaceStore.get(workspaceId);
  if (!ws) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  if (name !== undefined) ws.name = name.trim();
  if (description !== undefined) ws.description = description.trim();
  ws.updatedAt = new Date().toISOString();
  return ws;
}

function deleteWorkspace(workspaceId) {
  const members = memberStore.get(workspaceId);
  if (members) {
    for (const uid of members.keys()) {
      const set = userWorkspaces.get(uid);
      if (set) set.delete(workspaceId);
    }
  }
  memberStore.delete(workspaceId);
  workspaceStore.delete(workspaceId);
}

// ─── Membership ───────────────────────────────────────────────────────────────

function _addMember(workspaceId, userId, role) {
  const members = memberStore.get(workspaceId);
  if (!members) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  members.set(userId, { userId, role, joinedAt: new Date().toISOString() });
  if (!userWorkspaces.has(userId)) userWorkspaces.set(userId, new Set());
  userWorkspaces.get(userId).add(workspaceId);
}

function addMember(workspaceId, userId, role = 'member') {
  if (!ROLES.includes(role)) throw Object.assign(new Error(`Invalid role "${role}". Must be one of: ${ROLES.join(', ')}`), { status: 400 });
  const members = memberStore.get(workspaceId);
  if (!members) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  _addMember(workspaceId, userId, role);
  return getWorkspaceMember(workspaceId, userId);
}

function removeMember(workspaceId, userId) {
  const members = memberStore.get(workspaceId);
  if (!members) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  const member = members.get(userId);
  if (!member) return;
  members.delete(userId);
  const set = userWorkspaces.get(userId);
  if (set) set.delete(workspaceId);
}

function updateMemberRole(workspaceId, userId, newRole) {
  if (!ROLES.includes(newRole)) throw Object.assign(new Error(`Invalid role "${newRole}"`), { status: 400 });
  const members = memberStore.get(workspaceId);
  if (!members) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  const member = members.get(userId);
  if (!member) throw Object.assign(new Error('Member not found'), { status: 404 });
  member.role = newRole;
  return { ...member, workspaceId };
}

function getWorkspaceMember(workspaceId, userId) {
  const members = memberStore.get(workspaceId);
  const m = members?.get(userId);
  return m ? { ...m, workspaceId } : null;
}

function getMembers(workspaceId) {
  const members = memberStore.get(workspaceId);
  if (!members) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  return Array.from(members.values()).map(m => ({ ...m, workspaceId }));
}

function isMember(workspaceId, userId) {
  return memberStore.get(workspaceId)?.has(userId) ?? false;
}

function getMemberRole(workspaceId, userId) {
  return memberStore.get(workspaceId)?.get(userId)?.role ?? null;
}

// ─── User workspace queries ───────────────────────────────────────────────────

function getUserWorkspaces(userId) {
  const ids = userWorkspaces.get(userId) || new Set();
  return Array.from(ids)
    .map(id => workspaceStore.get(id))
    .filter(Boolean);
}

// ─── Role check helpers ───────────────────────────────────────────────────────

/**
 * Check if a user has at least `minRole` in a workspace.
 * Throws 403 if not.
 */
function requireRole(workspaceId, userId, minRole) {
  const role = getMemberRole(workspaceId, userId);
  if (!role) {
    const err = new Error('Not a member of this workspace');
    err.status = 403; err.code = 'NOT_MEMBER';
    throw err;
  }
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    const err = new Error(`Requires ${minRole} role — you have ${role}`);
    err.status = 403; err.code = 'INSUFFICIENT_ROLE';
    throw err;
  }
}

function hasRole(workspaceId, userId, minRole) {
  try { requireRole(workspaceId, userId, minRole); return true; }
  catch { return false; }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function listAllWorkspaces() {
  return Array.from(workspaceStore.values());
}

module.exports = {
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addMember,
  removeMember,
  updateMemberRole,
  getWorkspaceMember,
  getMembers,
  isMember,
  getMemberRole,
  getUserWorkspaces,
  requireRole,
  hasRole,
  listAllWorkspaces,
  ROLES,
  ROLE_RANK,
};
