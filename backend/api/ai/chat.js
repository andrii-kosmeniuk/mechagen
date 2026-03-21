const { callAI } = require('../../services/gemini');

const SYSTEM_PROMPT = `You are a mechanical engineering AI co-pilot embedded in MechaGen, a 3D part design tool.

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const reply = await callAI(SYSTEM_PROMPT, message.trim());
    return res.status(200).json({ reply });
  } catch (e) {
    console.error('[chat] Error:', e.message);
    return res.status(500).json({ error: 'Chat failed: ' + e.message });
  }
};
