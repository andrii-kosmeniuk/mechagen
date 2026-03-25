'use strict';

const assert = require('assert');
const { seedDemoData, getDemoProject, getDemoGenerations, getDemoBlueprint, getDemoLoadCount } = require('../src/services/demoService');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); failed++; }
}

console.log('\n📋 demoService tests\n');

// Seed fresh demo data for tests
seedDemoData({
  project:     { id: 'demo-p1', name: 'Test Demo', userId: 'demo-user' },
  generations: [
    { id: 'demo-g1', prompt: 'Test bracket', status: 'ready', userId: 'demo-user' },
  ],
  blueprint:   { id: 'demo-b1', filename: 'test.png' },
});

test('getDemoProject returns seeded project', () => {
  const p = getDemoProject();
  assert.strictEqual(p.id, 'demo-p1');
  assert.strictEqual(p._isDemo, true);
});

test('getDemoProject increments load count', () => {
  const before = getDemoLoadCount();
  getDemoProject();
  assert.strictEqual(getDemoLoadCount(), before + 1);
});

test('getDemoProject never returns real userId data', () => {
  const p = getDemoProject();
  assert.strictEqual(p.userId, 'demo-user', 'should be demo-user, not a real user');
});

test('getDemoGenerations returns array', () => {
  const gens = getDemoGenerations();
  assert.ok(Array.isArray(gens));
  assert.ok(gens.length >= 1);
});

test('getDemoGenerations marks all as demo', () => {
  const gens = getDemoGenerations();
  assert.ok(gens.every(g => g._isDemo === true));
});

test('getDemoBlueprint returns seeded blueprint', () => {
  const b = getDemoBlueprint();
  assert.strictEqual(b.id, 'demo-b1');
  assert.strictEqual(b._isDemo, true);
});

test('demo data isolation: project id is demo-p1 not a real uuid', () => {
  const p = getDemoProject();
  assert.ok(p.id.startsWith('demo-'), 'demo ids should start with demo-');
});

test('getDemoGenerations returns generations with status ready', () => {
  const gens = getDemoGenerations();
  assert.ok(gens.some(g => g.status === 'ready'));
});

test('re-seeding replaces old data', () => {
  seedDemoData({
    project:     { id: 'demo-p-new', name: 'New Demo', userId: 'demo-user' },
    generations: [],
    blueprint:   null,
  });
  const p = getDemoProject();
  assert.strictEqual(p.id, 'demo-p-new');
});

test('getDemoBlueprint falls back to default when null seeded', () => {
  const b = getDemoBlueprint();
  assert.ok(b._isDemo === true);
  assert.ok(b.id); // default blueprint always has an id
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
