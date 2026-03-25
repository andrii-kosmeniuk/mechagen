'use strict';

/**
 * Access Control Service — Phase 4
 *
 * Enforces project/generation/export access based on:
 *   - ownership (userId === resource.userId)
 *   - workspace membership (resource.workspaceId + isMember check)
 *   - role level (viewer can read, member+ can write)
 */

const { isMember, getMemberRole, ROLE_RANK } = require('./workspaceService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _err(msg, status = 403, code = 'ACCESS_DENIED') {
  return Object.assign(new Error(msg), { status, code });
}

function _isOwner(userId, resource) {
  return resource.userId === userId || resource.createdBy === userId || resource.ownerUserId === userId;
}

function _hasWorkspaceRole(userId, workspaceId, minRole = 'viewer') {
  if (!workspaceId) return false;
  if (!isMember(workspaceId, userId)) return false;
  const role = getMemberRole(workspaceId, userId);
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

// ─── Project access ───────────────────────────────────────────────────────────

/**
 * Check if user can READ a project.
 */
function canReadProject(userId, project) {
  if (_isOwner(userId, project)) return true;
  if (_hasWorkspaceRole(userId, project.workspaceId, 'viewer')) return true;
  return false;
}

/**
 * Check if user can WRITE (edit/delete) a project.
 */
function canWriteProject(userId, project) {
  if (_isOwner(userId, project)) return true;
  if (_hasWorkspaceRole(userId, project.workspaceId, 'member')) return true;
  return false;
}

/**
 * Assert read access. Throws 403 if denied.
 */
function assertReadProject(userId, project) {
  if (!canReadProject(userId, project)) throw _err('Access denied to project');
}

/**
 * Assert write access. Throws 403 if denied.
 */
function assertWriteProject(userId, project) {
  if (!canWriteProject(userId, project)) throw _err('Write access denied to project');
}

// ─── Generation access ────────────────────────────────────────────────────────

/**
 * Generation is accessible if the user owns it, or it belongs to a workspace the user is in.
 */
function canAccessGeneration(userId, generation) {
  if (!generation) return false;
  if (generation.userId === userId) return true;
  if (_hasWorkspaceRole(userId, generation.workspaceId, 'viewer')) return true;
  return false;
}

function assertAccessGeneration(userId, generation) {
  // If generation has no userId (Phase 1/2/3 compat — all generations accessible)
  if (!generation.userId) return;
  if (!canAccessGeneration(userId, generation)) throw _err('Access denied to generation');
}

// ─── Export access ────────────────────────────────────────────────────────────

function canAccessExport(userId, exportRecord) {
  if (!exportRecord) return false;
  if (exportRecord.userId === userId) return true;
  if (_hasWorkspaceRole(userId, exportRecord.workspaceId, 'viewer')) return true;
  return false;
}

// ─── Workspace admin checks ───────────────────────────────────────────────────

/**
 * Assert the user is an admin-level member of a workspace.
 */
function assertWorkspaceAdmin(userId, workspaceId) {
  if (!_hasWorkspaceRole(userId, workspaceId, 'admin')) {
    throw _err('Requires admin role in workspace', 403, 'INSUFFICIENT_ROLE');
  }
}

/**
 * Assert the user is the owner of a workspace.
 */
function assertWorkspaceOwner(userId, workspaceId) {
  const role = getMemberRole(workspaceId, userId);
  if (role !== 'owner') throw _err('Requires owner role in workspace', 403, 'INSUFFICIENT_ROLE');
}

// ─── Admin access ─────────────────────────────────────────────────────────────

/**
 * Check if user is a platform admin (plan-based).
 * Uses subscriptionService to avoid circular dep — passed in as param.
 */
function assertPlatformAdmin(userId, getUserPlanFn) {
  const plan = getUserPlanFn(userId);
  if (!plan?.features?.adminAccess) {
    throw _err('Admin access required', 403, 'NOT_ADMIN');
  }
}

module.exports = {
  canReadProject,
  canWriteProject,
  assertReadProject,
  assertWriteProject,
  canAccessGeneration,
  assertAccessGeneration,
  canAccessExport,
  assertWorkspaceAdmin,
  assertWorkspaceOwner,
  assertPlatformAdmin,
};
