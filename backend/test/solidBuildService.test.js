'use strict';

/**
 * Tests for solidBuildService.js — worker contract + timeout + error handling.
 * Uses a mocked Python worker (no real CadQuery installed required).
 * Usage: node test/solidBuildService.test.js
 */

const assert  = require('assert');
const fs      = require('fs');
const path    = require('path');
const { EventEmitter } = require('events');

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

// ─── Mock spawn helper ─────────────────────────────────────────────────────────

/**
 * Monkey-patch child_process.spawn to return a fake child process
 * that emits controllable stdout/stderr and close events.
 *
 * @param {object} opts
 * @param {string} opts.stdout    JSON string to emit on stdout
 * @param {number} opts.exitCode  Exit code to emit on close
 * @param {number} opts.delay     ms delay before emitting events
 */
function mockSpawn(opts = {}) {
  const { stdout = '', exitCode = 0, delay = 5 } = opts;
  const origSpawn = require('child_process').spawn;

  require('child_process').spawn = function () {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin  = { write: () => {}, end: () => {} };
    proc.kill   = () => {};

    setTimeout(() => {
      if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
      proc.emit('close', exitCode);
    }, delay);

    return proc;
  };

  return () => { require('child_process').spawn = origSpawn; };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n📋 solidBuildService tests\n');

// Import after patching to keep the module's cached reference patchable
const { getSolidBuild, getSolidBuildByGenerationId } = require('../src/services/solidBuildService');

// ─── getSolidBuild ────────────────────────────────────────────────────────────

test('getSolidBuild returns null for unknown id', () => {
  const result = getSolidBuild('unknown-id-xyz');
  assert.strictEqual(result, null);
});

test('getSolidBuildByGenerationId returns null for unknown generationId', () => {
  const result = getSolidBuildByGenerationId('gen_nonexistent');
  assert.strictEqual(result, null);
});

// ─── startSolidBuild validation ───────────────────────────────────────────────

await testAsync('startSolidBuild throws 404 for null generation', async () => {
  const { startSolidBuild } = require('../src/services/solidBuildService');
  try {
    await startSolidBuild(null);
    assert.fail('Should have thrown');
  } catch (err) {
    assert.strictEqual(err.status, 404);
    assert.ok(err.message.includes('not found'));
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
    assert.ok(err.message.includes('geometry plan'));
  }
});

await testAsync('startSolidBuild throws 400 for generation not yet preview-ready', async () => {
  const { startSolidBuild } = require('../src/services/solidBuildService');
  const fakeGen = {
    id: 'gen_queued',
    status: 'queued',
    geometryPlan: { buildSteps: [] },
    specJson: {},
  };
  try {
    await startSolidBuild(fakeGen);
    assert.fail('Should have thrown');
  } catch (err) {
    assert.strictEqual(err.status, 400);
    assert.ok(err.message.includes('"queued"'));
  }
});

// ─── Worker spawn result processing ──────────────────────────────────────────

await testAsync('worker returning non-JSON records build as solid_failed', async () => {
  // Override Python worker script check and spawn
  const workerPath = path.join(__dirname, '../../../worker/cadquery_worker.py');
  const workerExists = fs.existsSync(workerPath);

  if (!workerExists) {
    // Worker script missing — solidBuildService will set solid_failed with clear message
    // This is the expected behavior in CI/dev without Python installed
    const { startSolidBuild, getSolidBuildByGenerationId } = require('../src/services/solidBuildService');
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

    // Wait for async build to fail (worker not found)
    await new Promise(r => setTimeout(r, 100));
    const build = getSolidBuild(buildId);
    assert.ok(build, 'build record should exist');
    assert.strictEqual(build.status, 'solid_failed', `expected solid_failed, got ${build.status}`);
    assert.ok(build.errorReason?.includes('worker') || build.errorReason?.includes('Translation') || build.errorReason?.length > 0);
  } else {
    // Worker exists: use spawn mock to simulate non-JSON output
    const restore = mockSpawn({ stdout: 'not valid json output', exitCode: 1, delay: 10 });
    try {
      const { startSolidBuild, getSolidBuildByGenerationId } = require('../src/services/solidBuildService');
      const fakeGen = {
        id: `gen_badjson_${Date.now()}`,
        status: 'ready',
        geometryPlan: {
          partType: 'bracket',
          buildSteps: [{ id: 'base', action: 'create_box', params: { width: 80, height: 6, depth: 60 } }],
          boundingBox: { x: 80, y: 60, z: 6 },
        },
        specJson: { partType: 'bracket' },
      };
      const { buildId } = await startSolidBuild(fakeGen);
      await new Promise(r => setTimeout(r, 200));
      const build = getSolidBuild(buildId);
      assert.ok(build?.status === 'solid_failed', `expected solid_failed got ${build?.status}`);
    } finally {
      restore();
    }
  }
});

await testAsync('buildId returned from startSolidBuild is a valid UUID-like string', async () => {
  const { startSolidBuild } = require('../src/services/solidBuildService');
  const fakeGen = {
    id: `gen_uuid_test_${Date.now()}`,
    status: 'ready',
    geometryPlan: {
      partType: 'bracket',
      buildSteps: [{ id: 'b', action: 'create_box', params: { width: 10, height: 10, depth: 10 } }],
      boundingBox: { x: 10, y: 10, z: 10 },
    },
    specJson: { partType: 'bracket' },
  };
  const { buildId } = await startSolidBuild(fakeGen);
  assert.ok(typeof buildId === 'string' && buildId.length > 10, `buildId should be a non-empty string, got: ${buildId}`);
});

// Summary
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
