'use strict';

const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const TIMEOUT = 25_000; // 25 seconds — Vercel limit is 30

// Smart model router — complex geometry gets a bigger model
const MODELS = {
  complex: 'meta/llama-3.3-70b-instruct',   // bearings, gears — complex loops
  fast:    'meta/llama-3.1-70b-instruct',   // bolts, brackets — simpler code
};

/** User asked for a toothed gear — models often cheat with a plain ring; we inject a hard mandate. */
function modelPromptDemandsToothedGear(prompt) {
  const p = (prompt || '').toLowerCase();
  if (!/\b(gear|gears|sprocket|pinion|helical|spur|cog)\b/.test(p)) return false;
  if (/\b(sprocket|pinion)\b/.test(p)) return true;
  return /\b\d+\s*teeth\b/.test(p) || /\bteeth\b/.test(p) || /\btooth\b/.test(p);
}

function selectModel(prompt, options = {}) {
  if (options.highDetail || options.gearMandate) return MODELS.complex;
  const p = (prompt || '').toLowerCase();
  if (
    p.includes('bearing') ||
    p.includes('gear') ||
    p.includes('sprocket') ||
    p.includes('thread') ||
    p.includes('threaded') ||
    p.includes('helical') ||
    p.includes('washer') ||
    p.includes('fastener') ||
    p.includes('realistic') ||
    p.includes('detailed') ||
    p.includes('involute') ||
    p.includes('spline') ||
    p.includes('keyway') ||
    p.includes('spindle') ||
    p.includes('cnc') ||
    p.includes('spur') ||
    p.includes('robot') ||
    p.includes('robotic') ||
    p.includes('servo') ||
    p.includes('revolute') ||
    p.includes('6-dof') ||
    p.includes('6 dof') ||
    p.includes('dof') ||
    (p.includes('joint') && p.includes('arm')) ||
    (p.includes('flange') && (p.includes('mount') || p.includes('servo')))
  ) {
    return MODELS.complex;
  }
  return MODELS.fast;
}

const SYSTEM_PROMPT = require('./cadquerySystemPrompt');


const HIGH_DETAIL_SUFFIX =
  '\n\n[MECHAGEN: HIGH_DETAIL=true] Maximum practical detail. ' +
  'BOLTS / FASTENERS: hex head MUST be polygon(6) not a disk; ' +
  '**chamfer the hex head top edge** (`head.faces(">Z").edges().chamfer(0.4)`) and add a chamfered shank tip; ' +
  '**n_grooves = min(160, turns * 24)** — very fine spiral; cutter box thin: `box(0.5, 0.2, pitch * 0.75)`. ' +
  'Washer annulus: distinct OD/ID with real thickness. Smooth shank + threaded shank as separate geometry. ' +
  'BALL BEARINGS: **no chamfer, no fillet** after unions — `result = parts` only. ' +
  'GEARS / SPROCKETS: follow SECTION 5 spur-gear template — **N teeth** in `for i in range(N)`, bore cut, keyway cut; ' +
  'use `transformed(offset=..., rotate=...)` never `origin=`.';

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
  if (options.highDetail) t += HIGH_DETAIL_SUFFIX;
  return t;
}

/**
 * Builds the user message content.
 * Text-only → string. With image → multimodal array.
 */
function buildUserContent(prompt, image, options = {}) {
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

  const gearMandate = modelPromptDemandsToothedGear(prompt);
  const modelOpts = { ...options, gearMandate };
  const model      = selectModel(prompt, modelOpts);
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT);

  console.log(
    `[AI] model=${model} highDetail=${!!options.highDetail} gearMandate=${gearMandate} boltMandate=${boltMandate} prompt="${(prompt || '').slice(0, 60)}"`
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
        temperature: gearMandate ? 0.12 : 0.2,
        // Long CadQuery scripts; cap if your API returns “max_tokens” errors
        max_tokens:
          options.highDetail || gearMandate ? 6144 : 4096,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: buildUserContent(prompt, image, modelOpts) }
        ]
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('AI request timed out after 25 seconds');
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

  // Strip markdown fences — models often wrap CadQuery in python blocks despite instructions
  let code = content.trim();
  code = code
    .replace(/^```(?:python|py|javascript|js|jscad)?\s*\r?\n?/im, '')
    .replace(/\r?\n```\s*$/im, '')
    .trim();

  console.log(`[AI] code length=${code.length} chars`);
  return code;
}

module.exports = { callNemotron };
