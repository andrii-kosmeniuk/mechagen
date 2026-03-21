const { callAI } = require('../../services/gemini');
const { validatePrompt } = require('../../utils/validate');

const SYSTEM_PROMPT = `You are a JSCAD code generator for 3D mechanical parts.
Generate valid JavaScript code that uses the jscadModeling library.

The code receives \`jscadModeling\` as an argument. You must define a \`main()\` function that returns geometry.

Available APIs (all under jscadModeling):
  primitives: cuboid, cylinder, sphere, torus, roundedCuboid, geodesicSphere
  booleans:   union, subtract, intersect
  transforms: translate, rotate, scale, center, align
  utils:      degToRad

Example (plate with hole):

const { primitives, booleans, transforms } = jscadModeling;
function main() {
  const plate = primitives.cuboid({ size: [4, 0.5, 3] });
  const hole  = primitives.cylinder({ radius: 0.3, height: 1, segments: 32 });
  return booleans.subtract(plate, hole);
}

Rules:
- Return ONLY JavaScript code. No markdown fences, no explanation.
- Code MUST define a main() function.
- main() MUST return a single geometry (use booleans.union to combine multiple bodies).
- Use booleans.subtract for holes and cutouts.
- Keep dimensions reasonable (fit within ~10 units).
- Use at least 32 segments for cylinders and spheres for smooth rendering.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { prompt } = req.body || {};
  const err = validatePrompt(prompt);
  if (err) return res.status(400).json({ success: false, error: err });

  try {
    let code = await callAI(SYSTEM_PROMPT, prompt);
    // Strip markdown fences the model might wrap the code in
    code = code.replace(/^```(?:javascript|js)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
    return res.status(200).json({ success: true, jscad_code: code });
  } catch (e) {
    console.error('[generate-jscad] Error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
};
