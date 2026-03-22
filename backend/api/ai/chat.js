const { callCopilotChat } = require('../../lib/ai');

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
    const reply = await callCopilotChat(message.trim());
    return res.status(200).json({ reply });
  } catch (e) {
    const st = Number(e.status);
    const status = st >= 400 && st < 600 ? st : 500;
    console.error('[chat] Error:', e.message);
    return res.status(status).json({ error: e.message || 'Chat failed' });
  }
};
