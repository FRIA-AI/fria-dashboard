import { supabaseAdmin, resolveTenantFromToken } from '../lib/resolveTenant.js';

const N8N_URL = 'https://roadnlmx.app.n8n.cloud/webhook/fria-chat';

// Mismo patron que trigger-rfq.js -- el navegador llama aqui, nunca a n8n
// directo. El secreto compartido solo existe del lado del servidor.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  const tenantId = await resolveTenantFromToken(token);
  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const verifiedEmail = userData?.user?.email || req.body?.userEmail;

  const payload = { ...req.body, userEmail: verifiedEmail };

  try {
    const n8nRes = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fria-secret': process.env.FRIA_INTERNAL_SECRET,
      },
      body: JSON.stringify(payload),
    });
    const data = await n8nRes.json();
    return res.status(n8nRes.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo conectar con el Chat.' });
  }
}
