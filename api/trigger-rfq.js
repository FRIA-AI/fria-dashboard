import { supabaseAdmin, resolveTenantFromToken } from '../lib/resolveTenant.js';

// Proxy autenticado hacia el webhook de n8n que dispara el envío de RFQ a
// carriers. El navegador nunca ve FRIA_INTERNAL_SECRET -- lo agrega este
// endpoint del lado del servidor, después de verificar que quien llama
// tiene una sesión real de Supabase (resolveTenantFromToken). Así el
// webhook de n8n puede exigir el secreto (Header Auth) sin que el secreto
// tenga que vivir en código que corre en el navegador.
const N8N_URL = 'https://roadnlmx.app.n8n.cloud/webhook/fria-envio-rfq';

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

  // UserEmail se re-verifica contra el token real en vez de confiar en lo
  // que mande el body -- mismo criterio que el resto de los endpoints.
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
