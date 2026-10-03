import { resolveTenantFromToken } from '../lib/resolveTenant.js';

// Este endpoint recibe un archivo (multipart/form-data), así que Vercel NO
// debe intentar parsear el body como JSON -- lo leemos crudo y lo
// reenviamos tal cual a n8n, agregando el secreto compartido del lado del
// servidor. El Content-Type original (con el boundary del multipart) se
// reenvía sin tocar, si no, n8n no puede volver a separar los campos.
export const config = {
  api: { bodyParser: false },
};

const N8N_URL = 'https://roadnlmx.app.n8n.cloud/webhook/fria-tarifarios';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

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

  try {
    const rawBody = await readRawBody(req);
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
