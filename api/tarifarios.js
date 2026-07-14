// FRIA Tarifarios API — actualmente sin uso.
// Apunta al webhook de ingesta de NORA (no de FRIA) y ya no lo llama ningún
// componente del frontend (RateCardsPage.jsx quedó desactivado — ver Sección
// 11.4). Reescribir para apuntar al workflow de ingesta de FRIA cuando exista.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const response = await fetch('https://roadnlmx.app.n8n.cloud/webhook/nora-tarifarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reach n8n', details: error.message });
  }
}
