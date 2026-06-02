export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { history, system } = req.body;

    // Anthropic requires messages to start with 'user' role
    // Filter out the initial assistant greeting and ensure proper alternation
    let messages = (history || []).filter(m => m.role === 'user' || m.role === 'assistant');
    
    // Drop leading assistant messages
    while (messages.length > 0 && messages[0].role === 'assistant') {
      messages = messages.slice(1);
    }

    // Ensure we have at least one message
    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: system,
        messages: messages,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Anthropic error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.content?.[0]?.text || 'Sorry, I could not process that.';
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reach Anthropic', details: error.message });
  }
}
