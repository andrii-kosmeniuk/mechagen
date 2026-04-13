'use strict';

/**
 * Workspace Routes
 * GET/POST /api/workspaces
 * GET/PATCH/DELETE /api/workspaces/:id
 * GET/POST /api/workspaces/:id/members
 * PATCH/DELETE /api/workspaces/:id/members/:uid
 * GET /api/workspaces/:id/usage
 */

const {
  listMyWorkspaces, createWorkspace, getWorkspace, updateWorkspace, deleteWorkspace,
  listMembers, addMember, updateMemberRole, removeMember,
} = require('../api/workspaceHandler');
const { getWorkspaceUsage } = require('../api/usageHandler');
const { authMiddleware } = require('../middleware/auth');

async function handle(req, res, _rawRes, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/workspaces') {
    if (method === 'GET')  { await req._runChain([authMiddleware], listMyWorkspaces); return true; }
    if (method === 'POST') { req.body = await req._readBody().catch(() => ({})); await req._runChain([authMiddleware], createWorkspace); return true; }
  }

  const wsMatch = pathname.match(/^\/api\/workspaces\/([^/]+)$/);
  if (wsMatch) {
    req.params = { id: wsMatch[1] };
    if (method === 'GET')    { await req._runChain([authMiddleware], getWorkspace); return true; }
    if (method === 'PATCH')  { req.body = await req._readBody().catch(() => ({})); await req._runChain([authMiddleware], updateWorkspace); return true; }
    if (method === 'DELETE') { await req._runChain([authMiddleware], deleteWorkspace); return true; }
  }

  const wsMembersMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/members$/);
  if (wsMembersMatch) {
    req.params = { id: wsMembersMatch[1] };
    if (method === 'GET')  { await req._runChain([authMiddleware], listMembers); return true; }
    if (method === 'POST') { req.body = await req._readBody().catch(() => ({})); await req._runChain([authMiddleware], addMember); return true; }
  }

  const wsMemberMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/);
  if (wsMemberMatch) {
    req.params = { id: wsMemberMatch[1], uid: wsMemberMatch[2] };
    if (method === 'PATCH')  { req.body = await req._readBody().catch(() => ({})); await req._runChain([authMiddleware], updateMemberRole); return true; }
    if (method === 'DELETE') { await req._runChain([authMiddleware], removeMember); return true; }
  }

  const wsUsageMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/usage$/);
  if (wsUsageMatch && method === 'GET') {
    req.params = { id: wsUsageMatch[1] };
    await req._runChain([authMiddleware], getWorkspaceUsage);
    return true;
  }

  return false;
}

module.exports = { handle };
