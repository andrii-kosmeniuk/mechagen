'use strict';

const assert = require('assert');
const {
  createWorkspace, getWorkspace, updateWorkspace, deleteWorkspace,
  addMember, removeMember, updateMemberRole, getMembers, getMemberRole,
  isMember, getUserWorkspaces, requireRole, hasRole, ROLES,
} = require('../src/services/workspaceService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 workspaceService tests\n');

const owner  = `ws-owner-${Date.now()}`;
const admin  = `ws-admin-${Date.now()}`;
const member = `ws-member-${Date.now()}`;
const viewer = `ws-viewer-${Date.now()}`;
const stranger = `ws-stranger-${Date.now()}`;

let ws;

test('createWorkspace creates with owner as owner role', () => {
  ws = createWorkspace({ name: 'Test WS', ownerUserId: owner });
  assert.ok(ws.id, 'should have id');
  assert.strictEqual(ws.name, 'Test WS');
  assert.strictEqual(ws.ownerUserId, owner);
  assert.strictEqual(getMemberRole(ws.id, owner), 'owner');
});

test('createWorkspace throws without name', () => {
  assert.throws(() => createWorkspace({ ownerUserId: owner }), { status: 400 });
});

test('getWorkspace returns workspace by id', () => {
  const found = getWorkspace(ws.id);
  assert.strictEqual(found.id, ws.id);
});

test('getWorkspace returns null for unknown id', () => {
  const found = getWorkspace('nonexistent-id');
  assert.strictEqual(found, null);
});

test('updateWorkspace changes name', () => {
  const updated = updateWorkspace(ws.id, { name: 'Updated WS' });
  assert.strictEqual(updated.name, 'Updated WS');
});

test('addMember adds with correct role', () => {
  addMember(ws.id, admin,  'admin');
  addMember(ws.id, member, 'member');
  addMember(ws.id, viewer, 'viewer');
  assert.strictEqual(getMemberRole(ws.id, admin),  'admin');
  assert.strictEqual(getMemberRole(ws.id, member), 'member');
  assert.strictEqual(getMemberRole(ws.id, viewer), 'viewer');
});

test('addMember throws for invalid role', () => {
  assert.throws(() => addMember(ws.id, stranger, 'superuser'), { status: 400 });
});

test('isMember returns true for members', () => {
  assert.strictEqual(isMember(ws.id, admin), true);
  assert.strictEqual(isMember(ws.id, stranger), false);
});

test('getMembers returns all 4 members', () => {
  const members = getMembers(ws.id);
  assert.ok(members.length >= 4, `expected >=4 members, got ${members.length}`);
});

test('getUserWorkspaces returns workspace for owner', () => {
  const workspaces = getUserWorkspaces(owner);
  assert.ok(workspaces.some(w => w.id === ws.id));
});

test('requireRole allows admin for admin+ check', () => {
  assert.doesNotThrow(() => requireRole(ws.id, owner, 'admin'));
  assert.doesNotThrow(() => requireRole(ws.id, admin, 'admin'));
});

test('requireRole throws for viewer on admin check', () => {
  assert.throws(() => requireRole(ws.id, viewer, 'admin'), { status: 403 });
});

test('requireRole throws 403 for non-member', () => {
  assert.throws(() => requireRole(ws.id, stranger, 'viewer'), { status: 403 });
});

test('hasRole returns boolean correctly', () => {
  assert.strictEqual(hasRole(ws.id, owner, 'owner'), true);
  assert.strictEqual(hasRole(ws.id, viewer, 'admin'), false);
  assert.strictEqual(hasRole(ws.id, stranger, 'viewer'), false);
});

test('updateMemberRole changes role', () => {
  updateMemberRole(ws.id, viewer, 'member');
  assert.strictEqual(getMemberRole(ws.id, viewer), 'member');
});

test('removeMember removes from workspace', () => {
  removeMember(ws.id, member);
  assert.strictEqual(isMember(ws.id, member), false);
});

test('ROLES array has correct order', () => {
  assert.deepStrictEqual(ROLES, ['viewer', 'member', 'admin', 'owner']);
});

test('deleteWorkspace removes workspace and members', () => {
  const tempWs = createWorkspace({ name: 'Temp', ownerUserId: 'temp-owner' });
  deleteWorkspace(tempWs.id);
  assert.strictEqual(getWorkspace(tempWs.id), null);
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
