'use strict';

const assert = require('assert');
const { canReadProject, canWriteProject, assertReadProject, assertWriteProject, assertWorkspaceAdmin } = require('../src/services/accessControlService');
const { createWorkspace, addMember } = require('../src/services/workspaceService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 accessControlService tests\n');

// Setup workspace
const ownerU = `ac-owner-${Date.now()}`;
const memberU = `ac-member-${Date.now()}`;
const viewerU = `ac-viewer-${Date.now()}`;
const stranger = `ac-stranger-${Date.now()}`;
const wsX = createWorkspace({ name: 'AC Test', ownerUserId: ownerU });
addMember(wsX.id, memberU, 'member');
addMember(wsX.id, viewerU, 'viewer');

// Projects
const ownedProject    = { id: 'p1', userId: ownerU };
const wsProject       = { id: 'p2', userId: 'other-user', workspaceId: wsX.id };
const privateProject  = { id: 'p3', userId: 'other-user' };

// ─── canReadProject ───────────────────────────────────────────────────────────

test('owner can read their own project', () => {
  assert.strictEqual(canReadProject(ownerU, ownedProject), true);
});

test('workspace viewer can read workspace project', () => {
  assert.strictEqual(canReadProject(viewerU, wsProject), true);
});

test('workspace member can read workspace project', () => {
  assert.strictEqual(canReadProject(memberU, wsProject), true);
});

test('stranger cannot read private project', () => {
  assert.strictEqual(canReadProject(stranger, privateProject), false);
});

test('stranger cannot read workspace project without membership', () => {
  assert.strictEqual(canReadProject(stranger, wsProject), false);
});

// ─── canWriteProject ──────────────────────────────────────────────────────────

test('owner can write their own project', () => {
  assert.strictEqual(canWriteProject(ownerU, ownedProject), true);
});

test('workspace member can write workspace project', () => {
  assert.strictEqual(canWriteProject(memberU, wsProject), true);
});

test('workspace viewer cannot write workspace project', () => {
  assert.strictEqual(canWriteProject(viewerU, wsProject), false);
});

test('stranger cannot write workspace project', () => {
  assert.strictEqual(canWriteProject(stranger, wsProject), false);
});

// ─── assertReadProject ────────────────────────────────────────────────────────

test('assertReadProject does not throw for owner', () => {
  assert.doesNotThrow(() => assertReadProject(ownerU, ownedProject));
});

test('assertReadProject throws 403 for stranger on private project', () => {
  assert.throws(() => assertReadProject(stranger, privateProject), { status: 403 });
});

// ─── assertWriteProject ───────────────────────────────────────────────────────

test('assertWriteProject throws 403 for viewer on workspace project', () => {
  assert.throws(() => assertWriteProject(viewerU, wsProject), { status: 403 });
});

// ─── assertWorkspaceAdmin ─────────────────────────────────────────────────────

test('assertWorkspaceAdmin allows owner', () => {
  assert.doesNotThrow(() => assertWorkspaceAdmin(ownerU, wsX.id));
});

test('assertWorkspaceAdmin throws 403 for viewer', () => {
  assert.throws(() => assertWorkspaceAdmin(viewerU, wsX.id), { status: 403 });
});

test('assertWorkspaceAdmin throws 403 for stranger', () => {
  assert.throws(() => assertWorkspaceAdmin(stranger, wsX.id), { status: 403 });
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
