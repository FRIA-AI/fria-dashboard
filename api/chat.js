export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, history, system } = req.body;

    // Build conversation context for n8n
    // We append the history to the system prompt so Basic LLM Chain has full context
    const historyText = history && history.length > 1
      ? '\n\n## CONVERSATION HISTORY (most recent last)\n' +
        history.slice(0, -1).map(m => `${m.role === 'user' ? 'User' : 'NORA'}: ${m.content}`).join('\n')
      : '';

    const response = await fetch('https://roadnlmx.app.n8n.cloud/webhook/nora-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        system: system + historyText,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reach n8n', details: error.message });
  }
}
