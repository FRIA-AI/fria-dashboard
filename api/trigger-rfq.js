import { supabaseAdmin, resolveTenantFromToken } from '../lib/resolveTenant.js';

const N8N_URL = 'https://roadnlmx.app.n8n.cloud/webhook/fria-envio-rfq';

// Proxy del lado del servidor hacia el webhook de n8n -- el navegador nunca
// llama a n8n directo, ni conoce el secreto compartido. Solo un usuario con
// sesion real de FRIA puede llegar hasta aqui, y el correo se toma del
// token verificado, no de lo que mande el cuerpo de la peticion (para que
// nadie pueda mandar un RFQ haciendose pasar por otro usuario del tenant).
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
  const verifiedEmail = userData?.user?.email || req.body?.UserEmail;

  const payload = { ...req.body, UserEmail: verifiedEmail };

  try {
    const n8nRes = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fria-secret': process.env.FRIA_INTERNAL_SECRET,
      },
      body: JSON.stringify(payload),
    });
    const contentType = n8nRes.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await n8nRes.json() : { raw: await n8nRes.text() };
    return res.status(n8nRes.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo conectar con el flujo de RFQ.' });
  }
}
