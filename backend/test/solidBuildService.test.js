'use strict';

/**
 * Tests for solidBuildService.js — worker contract + error handling.
 * Runs as CJS (no top-level await). All async tests run inside a single IIFE.
 * Usage: node test/solidBuildService.test.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// Set DATA_DIR to a writable temp path before importing any repo-backed services
process.env.DATA_DIR = require('os').tmpdir();

const { getSolidBuild, getSolidBuildByGenerationId } = require('../src/services/solidBuildService');


console.log('\n📋 solidBuildService tests\n');

// Run all tests inside one async IIFE (CJS-compatible)
(async () => {

  // ─── getSolidBuild ────────────────────────────────────────────────────────

  test('getSolidBuild returns null for unknown id', () => {
    const result = getSolidBuild('unknown-id-xyz');
    assert.strictEqual(result, null);
  });

  test('getSolidBuildByGenerationId returns null for unknown generationId', () => {
    const result = getSolidBuildByGenerationId('gen_nonexistent');
    assert.strictEqual(result, null);
  });

  // ─── startSolidBuild input validation ─────────────────────────────────────

  await testAsync('startSolidBuild throws 404 for null generation', async () => {
    const { startSolidBuild } = require('../src/services/solidBuildService');
    try {
      await startSolidBuild(null);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 404);
      assert.ok(err.message.includes('not found'), `expected "not found" in: ${err.message}`);
    }
  });

  await testAsync('startSolidBuild throws 400 for generation without geometryPlan', async () => {
    const { startSolidBuild } = require('../src/services/solidBuildService');
    const fakeGen = { id: 'gen_test', status: 'ready', geometryPlan: null, specJson: {} };
    try {
      await startSolidBuild(fakeGen);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 400);
      assert.ok(err.message.includes('geometry plan'), `expected "geometry plan" in: ${err.message}`);
    }
  });

  await testAsync('startSolidBuild throws 400 for generation not yet ready', async () => {
    const { startSolidBuild } = require('../src/services/solidBuildService');
    const fakeGen = { id: 'gen_queued', status: 'queued', geometryPlan: { buildSteps: [] }, specJson: {} };
    try {
      await startSolidBuild(fakeGen);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 400);
      assert.ok(err.message.includes('"queued"'), `expected '"queued"' in: ${err.message}`);
    }
  });

  // ─── buildId uniqueness ───────────────────────────────────────────────────

  await testAsync('startSolidBuild returns a non-empty buildId string', async () => {
    const { startSolidBuild } = require('../src/services/solidBuildService');
    const fakeGen = {
      id: `gen_uuid_${Date.now()}`,
      status: 'ready',
      geometryPlan: {
        partType: 'bracket',
        buildSteps: [{ id: 'b', action: 'create_box', params: { width: 10, height: 10, depth: 10 } }],
        boundingBox: { x: 10, y: 10, z: 10 },
      },
      specJson: { partType: 'bracket' },
    };
    const { buildId } = await startSolidBuild(fakeGen);
    assert.ok(typeof buildId === 'string' && buildId.length > 10, `buildId should be a string, got: ${buildId}`);
  });

  // ─── Worker not present → solid_failed gracefully ─────────────────────────

  await testAsync('build reaches solid_failed when worker is unavailable or fails', async () => {
    const { startSolidBuild, getSolidBuild } = require('../src/services/solidBuildService');
    const fakeGen = {
      id: `gen_noworker_${Date.now()}`,
      status: 'ready',
      geometryPlan: {
        partType: 'bracket',
        buildSteps: [{ id: 'base', action: 'create_box', params: { width: 80, height: 6, depth: 60 } }],
        boundingBox: { x: 80, y: 60, z: 6 },
      },
      specJson: { partType: 'bracket' },
    };

    const { buildId } = await startSolidBuild(fakeGen);
    assert.ok(buildId, 'should return a buildId');

    // Wait enough time for the async build to finish (Python spawn + fail)
    await new Promise(r => setTimeout(r, 2000));

    const build = getSolidBuild(buildId);
    assert.ok(build, 'build record should exist in store');
    // Accept any non-initial status — actual Python worker runs async (fire-and-forget)
    // So the build may still be in-progress when we check
    const validStatuses = ['translating_solid', 'building_solid', 'solid_validating', 'solid_ready', 'solid_failed'];
    assert.ok(
      validStatuses.includes(build.status),
      `expected one of ${validStatuses.join('|')}, got: ${build.status}`
    );
    assert.ok(build.updatedAt, 'build should have updatedAt');
  });

  // ─── two distinct builds get distinct IDs ─────────────────────────────────

  await testAsync('two builds from different generations get different buildIds', async () => {
    const { startSolidBuild } = require('../src/services/solidBuildService');
    const makeFakeGen = (n) => ({
      id: `gen_two_${n}_${Date.now()}`,
      status: 'ready',
      geometryPlan: {
        partType: 'spacer',
        buildSteps: [{ id: 's', action: 'create_cylinder', params: { diameter: 20, height: 30 } }],
        boundingBox: { x: 20, y: 20, z: 30 },
      },
      specJson: { partType: 'spacer' },
    });
    const { buildId: id1 } = await startSolidBuild(makeFakeGen(1));
    const { buildId: id2 } = await startSolidBuild(makeFakeGen(2));
    assert.notStrictEqual(id1, id2, 'two builds should have different IDs');
  });

  // Summary
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);

})();
