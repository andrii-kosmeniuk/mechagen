'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const { sanitizeRequest } = require('./sanitize');
const { callNemotron } = require('./ai');

/**
 * Merge UI fields so project description / name are actually seen by the model.
 */
function buildModelPrompt(input) {
  const chunks = [];
  if (input.projectName) {
    chunks.push(`Part name: ${input.projectName}`);
  }
  if (input.context) {
    chunks.push(
      'Design requirements / constraints (you MUST respect these):\n' + input.context
    );
  }
  if (input.prompt) {
    chunks.push('Geometry to build:\n' + input.prompt);
  }
  return chunks.join('\n\n');
}

/**
 * AI → CadQuery (stdin) → STL file → { stl: base64, code: raw AI text }
 * @param {object} body - Same shape as POST /api/generate JSON body
 * @returns {{ stl: string, code: string }}
 */
async function executeGenerate(body) {
  const { value: input, error, status } = sanitizeRequest(body);
  if (error) {
    const e = new Error(error);
    e.status = status;
    throw e;
  }

  const modelPrompt = buildModelPrompt(input);

  const raw = await callNemotron(modelPrompt, input.image, {
    highDetail: input.highDetail,
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mechagen-'));
  const stlPath = path.join(tmpDir, 'output.stl');
  const runnerPath = path.join(__dirname, '..', 'python', 'runner.py');

  const runTimeout = input.highDetail ? 120_000 : 60_000;

  // Bolts, brackets, plates: keep chamfer/fillet (low union count, OCCT handles fine).
  // Bearings, gears: strip (complex unions break OCCT booleans on finish ops).
  const promptLower = (input.prompt || '').toLowerCase();
  const keepFinish =
    /\b(bolt|screw|nut|fastener|bracket|plate|flange|mount|washer)\b/.test(promptLower) &&
    !/\b(bearing|gear|sprocket|ball)\b/.test(promptLower);

  try {
    execSync(`python3 "${runnerPath}" "${stlPath}"`, {
      input: raw,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: runTimeout,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        MECHAGEN_HIGH_DETAIL: input.highDetail ? '1' : '0',
        MECHAGEN_KEEP_FINISH_OPS: keepFinish ? '1' : '0',
      },
    });
    const stlBuffer = fs.readFileSync(stlPath);
    const stl = stlBuffer.toString('base64');
    return { stl, code: raw };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stderrTail = stderr.trim().split('\n').slice(-12).join('\n');
    console.error('[executeGenerate] CadQuery run failed:\n', stderrTail || err.message);
    const e = new Error(
      'Failed to generate 3D model. CadQuery run failed. ' +
        (stderrTail
          ? `Python said:\n${stderrTail}`
          : 'Ensure CadQuery is installed (`pip install cadquery`) and the model returned valid Python.')
    );
    e.status = 502;
    e.detail = stderrTail;
    throw e;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) { /* ignore */ }
  }
}

module.exports = { executeGenerate };
