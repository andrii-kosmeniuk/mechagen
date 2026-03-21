const { callAI } = require('../services/gemini');
const { validatePrompt, sanitizeGeometry } = require('../utils/validate');

const SYSTEM_PROMPT = `You are a 3D mechanical part geometry generator. Given a text description of a mechanical part, return a JSON object that describes it using basic 3D primitives.

Return ONLY valid JSON — no markdown fences, no explanation, no text before or after.

JSON structure:
{
  "name": "Human-readable part name",
  "ballCount": <number, only include for bearings — how many balls>,
  "parts": [
    {
      "shape": "box" | "cylinder" | "sphere" | "torus" | "cone",
      "params": { <shape-specific, see below> },
      "color": "#hexcolor",
      "metalness": 0.0-1.0,
      "roughness": 0.0-1.0,
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 0 }
    }
  ]
}

Shape params:
  box      → { "w": width, "h": height, "d": depth }
  cylinder → { "r": radius, "h": height }
  sphere   → { "r": radius }
  torus    → { "r": major_radius, "tube": tube_radius }
  cone     → { "r": base_radius, "h": height }

Design rules:
1. Compose complex shapes from multiple primitives positioned relative to each other.
2. Center the assembly around the origin (0, 0, 0).
3. Keep overall dimensions within roughly a 4×4×4 unit bounding box.
4. Use realistic metallic colors: steel #8a9aaa, dark steel #3a3a4a, aluminum #c0c8d0, brass #b8a060, rubber #2a2a2a.
5. For HOLES: place a dark cylinder (color "#111118", metalness 0.3, roughness 0.8) at the hole location. Make its height slightly taller than the surface it pierces so it visually reads as a hole.
6. For CUTOUTS: use a dark box or cylinder to represent removed material.
7. Rotation values are in radians. Math.PI/2 ≈ 1.5708.
8. For plates/brackets: the main body is a box; add cylinders for mounting holes; add dark shapes for cutouts.
9. For bearings: set "ballCount" at the top level to the number of balls requested. The frontend renders bearings procedurally — you still need at least one part (a cylinder for the outer ring) so the response is valid, but the frontend will override the rendering.
10. Always include at least 3 parts to make the model visually interesting.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  const validationError = validatePrompt(prompt);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const raw = await callAI(SYSTEM_PROMPT, prompt, { json: true });
    const geom = sanitizeGeometry(raw);

    if (!geom || geom.parts.length === 0) {
      return res.status(500).json({ error: 'AI returned geometry with no valid parts — try rephrasing your prompt' });
    }

    return res.status(200).json(geom);
  } catch (err) {
    console.error('[generate] Error:', err.message);
    return res.status(500).json({ error: 'Generation failed: ' + err.message });
  }
};
