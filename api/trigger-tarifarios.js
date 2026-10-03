import { resolveTenantFromToken } from '../lib/resolveTenant.js';

// Se desactiva el parser automatico de Vercel para poder leer el cuerpo
// crudo (multipart, con el archivo adentro) y reenviarlo tal cual a n8n,
// sin tener que descomponerlo y reconstruirlo aqui.
export const config = {
  api: { bodyParser: false },
};

const N8N_URL = 'https://roadnlmx.app.n8n.cloud/webhook/fria-tarifarios';

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

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);

  try {
    const n8nRes = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'],
        'x-fria-secret': process.env.FRIA_INTERNAL_SECRET,
      },
      body: rawBody,
    });
    const contentType = n8nRes.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await n8nRes.json() : { raw: await n8nRes.text() };
    return res.status(n8nRes.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo conectar con el flujo de tarifarios.' });
  }
}
