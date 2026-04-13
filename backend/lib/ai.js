'use strict';

const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

/** “Simple” prompts — Nemotron often needs 30–90s+ for long CadQuery. */
const TIMEOUT_FAST_MS = 60_000;
/** highDetail / gear / bearing / long completions */
const TIMEOUT_COMPLEX_MS = 180_000;
/**
 * Override all AI timeouts (ms). If unset, fast/complex/JSON use values above.
 * Example: MECHAGEN_AI_TIMEOUT_MS=120000
 */

/**
 * Single chat model for all calls. NVIDIA ids are usually `nvidia/<name>`.
 * Bare `nemotron-…` → HTTP 404 on integrate.api.nvidia.com.
 */
function getChatModel() {
  return (
    process.env.MECHAGEN_AI_MODEL || 'google/gemma-4-31b-it'
  ).trim();
}

/** Max completion tokens — long CadQuery / JSON parts. Default high; lower if NVIDIA returns max_tokens errors. */
function getMaxOutputTokens() {
  const v = parseInt(process.env.MECHAGEN_AI_MAX_TOKENS || '32768', 10);
  if (Number.isFinite(v) && v >= 256) return Math.min(v, 131072);
  return 32768;
}

/** User asked for a toothed gear — models often cheat with a plain ring; we inject a hard mandate. */
function modelPromptDemandsToothedGear(prompt) {
  const p = (prompt || '').toLowerCase();
  if (!/\b(gear|gears|sprocket|pinion|helical|spur|cog)\b/.test(p)) return false;
  if (/\b(sprocket|pinion)\b/.test(p)) return true;
  return /\b\d+\s*teeth\b/.test(p) || /\bteeth\b/.test(p) || /\btooth\b/.test(p);
}

/** Ball / radial bearings — models often emit bad face selectors → empty-list Nth crashes. */
function modelPromptDemandsBearing(prompt) {
  const p = (prompt || '').toLowerCase();
  if (/\b(gear|gears|sprocket)\b/.test(p) && !/\b(bearing)\b/.test(p)) return false;
  if (
    /\b(ball bearing|radial ball|radial bearing|deep groove)\b/.test(p) ||
    /\b(inner race|outer race)\b/.test(p) ||
    (/\b(bearing|bearings)\b/.test(p) &&
      /\b(ball|balls|race|races|inner|outer)\b/.test(p))
  ) {
    return true;
  }
  return false;
}

const SYSTEM_PROMPT = require('./cadquerySystemPrompt');
const GEOMETRY_SYSTEM_PROMPT = require('./geometrySystemPrompt');
const ASSEMBLY_SYSTEM_PROMPT = require('./assemblySystemPrompt');

const HIGH_DETAIL_SUFFIX =
  '\n\n[MECHAGEN: HIGH_DETAIL=true] Maximum practical detail. ' +
  'BOLTS / FASTENERS: hex head MUST be polygon(6) not a disk; ' +
  '**chamfer the hex head top edge** (`head.faces(">Z").edges().chamfer(0.4)`) and add a chamfered shank tip; ' +
  '**cuts_per_turn = 30; n_grooves = turns * cuts_per_turn** — very fine spiral; groove_width = 2*pi*(d/2)/cuts_per_turn + 0.4; cutter `box(0.45, groove_width, pitch * 0.5)`. ' +
  'Washer annulus: distinct OD/ID with real thickness. Smooth shank + threaded shank as separate geometry. ' +
  'BALL BEARINGS: **no chamfer, no fillet** after unions — `result = parts` only. ' +
  'GEARS / SPROCKETS: follow SECTION 5 spur-gear template — **N teeth** in `for i in range(N)`, bore cut, keyway cut; ' +
  'use `transformed(offset=..., rotate=...)` never `origin=`.';

const BEARING_MANDATE_SUFFIX =
  '\n\n[MECHAGEN: MANDATORY RADIAL BALL BEARING — READ CAREFULLY]\n' +
  'The user asked for a **ball bearing** (races + rolling balls), not a plain washer ring.\n' +
  '**REQUIRED:** Follow the **SECTION 5 — RADIAL BALL BEARING** template in the system prompt (annulus extrudes + `sphere` in a `for` loop + chained `union`).\n' +
  'Set **n_balls** to the exact count from the user (e.g. six → `n_balls = 6`, eight → `8`).\n' +
  '**FORBIDDEN (runtime crash):** `.faces(...)[n]`, `.edges(...)[n]`, `.nth(`, string selectors that pick the **Nth** face/edge, or compound selectors like `and` / `or` when either side can be empty — these raise `ValueError: Can not return the Nth element of an empty list`.\n' +
  '**FORBIDDEN:** Any `.fillet` or `.chamfer` in the file for bearings.\n' +
  'Build geometry only with `cq.Workplane`, `circle`, `extrude`, `sphere`, `union`, `cut` — no post-union face picking for “finishing”.\n' +
  'Assign **`result`** to the final fused solid.';

const GEAR_MANDATE_SUFFIX =
  '\n\n[MECHAGEN: MANDATORY TOOTHED GEAR — READ CAREFULLY]\n' +
  'The user requested a **gear with teeth** (not a washer, not a bearing race, not a plain ring).\n' +
  '**FORBIDDEN:** output that is ONLY `circle(outer).circle(inner).extrude()` (hollow disk) with no tooth loop.\n' +
  '**REQUIRED in your Python:**\n' +
  '1) Set integer **N** = exact tooth count from the user text (e.g. "12 teeth" → `N = 12`).\n' +
  '2) A **`for i in range(N):`** loop that builds **tooth solids** and **`gear = gear.union(tooth)`** (one tooth per iteration), OR equivalent visible tooth cuts.\n' +
  '3) **Central bore:** `gear = gear.cut(cq.Workplane("XY").circle(bore_radius).extrude(height))` with realistic bore for a CNC spindle unless user gave a diameter.\n' +
  '4) If user said **keyway:** copy the **key_tool** \`box\` \`cut\` from system prompt SECTION 5 block **SPUR GEAR WITH BORE + KEYWAY**.\n' +
  '5) **Helical:** approximate as **spur** with the template; do not replace the whole part with a smooth torus or annulus.\n' +
  '6) Start from the **SECTION 5 spur-gear template** in the system prompt and only change `N`, `m`, `bore`, `width`, `key_w`, `key_d`.\n' +
  'Assign final solid to **`result`**.';

function augmentModelPromptText(text, options = {}) {
  let t = text || '';
  if (!t) return t;
  if (options.gearMandate) t += GEAR_MANDATE_SUFFIX;
  else if (options.bearingMandate) t += BEARING_MANDATE_SUFFIX;
  if (options.highDetail) t += HIGH_DETAIL_SUFFIX;
  return t;
}

/**
 * Builds the user message content.
 * Text-only → string. With image → multimodal array.
 */
function buildUserContent(prompt, image, options = {}) {
  if (options.geometryParts) {
    const base = (prompt ?? '').trim();
    if (!image) return base;
    const mediaType = image.startsWith('/9j/')
      ? 'image/jpeg'
      : image.startsWith('iVBORw0KGgo')
        ? 'image/png'
        : 'image/jpeg';
    const raw =
      base || 'Generate a JSON parts description for this mechanical part (primitives only).';
    return [
      { type: 'image_url', image_url: { url: `data:${mediaType};base64,${image}` } },
      { type: 'text', text: raw },
    ];
  }
  if (!image) return augmentModelPromptText(prompt ?? '', options);

  const mediaType = image.startsWith('/9j/')
    ? 'image/jpeg'
    : image.startsWith('iVBORw0KGgo')
      ? 'image/png'
      : 'image/jpeg'; // safe default

  const raw =
    prompt?.trim() || 'Generate a 3D model from this blueprint drawing';

  return [
    {
      type: 'image_url',
      image_url: { url: `data:${mediaType};base64,${image}` }
    },
    {
      type: 'text',
      text: augmentModelPromptText(raw, options)
    }
  ];
}

/**
 * Calls AI and returns the raw response text.
 * Throws on network error, timeout, or non-2xx API response.
 */
async function callNemotron(prompt, image, options = {}) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    const err = new Error('NVIDIA_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const geometryParts = !!options.geometryParts;
  const gearMandate = geometryParts ? false : modelPromptDemandsToothedGear(prompt);
  const bearingMandate =
    geometryParts || gearMandate ? false : modelPromptDemandsBearing(prompt);
  const modelOpts = { ...options, gearMandate, bearingMandate };
  const model = getChatModel();

  const envOverride = parseInt(process.env.MECHAGEN_AI_TIMEOUT_MS || '', 10);
  const timeoutMs = (() => {
    if (Number.isFinite(envOverride) && envOverride >= 10_000) {
      return envOverride;
    }
    if (geometryParts) return 60_000;
    if (options.highDetail || gearMandate || bearingMandate) {
      return TIMEOUT_COMPLEX_MS;
    }
    return TIMEOUT_FAST_MS;
  })();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  console.log(
    `[AI] model=${model} highDetail=${!!options.highDetail} gearMandate=${gearMandate} bearingMandate=${bearingMandate} geometryParts=${geometryParts} prompt="${(prompt || '').slice(0, 60)}"`
  );

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: geometryParts ? 0.15 : gearMandate || bearingMandate ? 0.12 : 0.2,
        max_tokens: geometryParts ? Math.min(getMaxOutputTokens(), 8192) : getMaxOutputTokens(),
        messages: [
          {
            role: 'system',
            content: options.taskType === 'assembly' 
              ? ASSEMBLY_SYSTEM_PROMPT 
              : geometryParts 
                ? GEOMETRY_SYSTEM_PROMPT 
                : SYSTEM_PROMPT,
          },
          { role: 'user',   content: buildUserContent(prompt, image, modelOpts) }
        ]
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      const sec = Math.round(timeoutMs / 1000);
      const e = new Error(`AI request timed out after ${sec} seconds`);
      e.status = 504;
      throw e;
    }
    const e = new Error(`Network error reaching AI: ${err.message}`);
    e.status = 502;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let message = `NVIDIA API error ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error?.message) message = body.error.message;
    } catch (_) { /* ignore */ }
    const e = new Error(message);
    e.status = response.status >= 500 ? 502 : response.status;
    throw e;
  }

  const data    = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    const e = new Error('Model returned an empty response');
    e.status = 502;
    throw e;
  }

  // Strip markdown fences — models often wrap output in code blocks despite instructions
  let code = content.trim();
  code = code
    .replace(/^```(?:python|py|javascript|js|jscad|json)?\s*\r?\n?/im, '')
    .replace(/\r?\n```\s*$/im, '')
    .trim();

  if (geometryParts || options.taskType === 'assembly') {
    const start = code.indexOf('{');
    const end = code.lastIndexOf('}');
    if (start >= 0 && end > start) {
      code = code.slice(start, end + 1);
    }
  }

  console.log(`[AI] response length=${code.length} chars geometryParts=${geometryParts}`);
  return code;
}

const COPILOT_SYSTEM_PROMPT = `You are a mechanical engineering AI co-pilot embedded in MechaGen, a 3D part design tool.

Your expertise covers:
- Mechanical design principles and best practices
- Material selection (metals, polymers, composites)
- Manufacturing processes (CNC machining, 3D printing, injection molding, casting)
- Stress analysis, fatigue, and failure modes
- Tolerancing and GD&T
- Assembly design and fastener selection
- Cost estimation and design-for-manufacturing optimization

Keep answers concise (2-4 sentences for simple questions, up to a short paragraph for complex ones).
When suggesting design changes, be specific about dimensions, materials, and tolerances.
Use SI units by default.`;

/**
 * Short chat for the AI Co-Pilot sidebar (not CadQuery generation).
 */
async function callCopilotChat(message) {
  const text = (message || '').trim();
  if (!text) {
    const e = new Error('Message is required');
    e.status = 400;
    throw e;
  }
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    const e = new Error('NVIDIA_API_KEY is not configured');
    e.status = 500;
    throw e;
  }
  const model = getChatModel();
  const chatTimeout = parseInt(
    process.env.MECHAGEN_AI_CHAT_TIMEOUT_MS || '120000',
    10
  );
  const timeoutMs =
    Number.isFinite(chatTimeout) && chatTimeout >= 5000 ? chatTimeout : 120_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.28,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: COPILOT_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      const sec = Math.round(timeoutMs / 1000);
      const e = new Error(`Chat request timed out after ${sec} seconds`);
      e.status = 504;
      throw e;
    }
    const e = new Error(`Network error: ${err.message}`);
    e.status = 502;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let msg = `NVIDIA API error ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error?.message) msg = body.error.message;
    } catch (_) { /* ignore */ }
    const e = new Error(msg);
    e.status = response.status >= 500 ? 502 : response.status;
    throw e;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    const e = new Error('Model returned an empty reply');
    e.status = 502;
    throw e;
  }
  return content.trim();
}

module.exports = { callNemotron, callCopilotChat };
