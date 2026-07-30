import crypto from 'crypto';
import { resolveTenantFromToken } from '../../../lib/resolveTenant.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

function signState(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', process.env.GOOGLE_OAUTH_STATE_SECRET)
    .update(b64)
    .digest('base64url');
  return `${b64}.${hmac}`;
}

export default async function handler(req, res) {
  // Antes esto confiaba en un tenantId mandado directo por el cliente --
  // cualquiera podia enganchar una cuenta de Gmail a un tenant ajeno con
  // solo cambiar un parametro en la URL. Ahora se resuelve el tenant real
  // a partir de la sesion verificada de Supabase Auth.
  const { accessToken } = req.query;

  const tenantId = await resolveTenantFromToken(accessToken);
  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const state = signState({
    tenantId,
    nonce: crypto.randomBytes(16).toString('hex'),
    ts: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',   // necesario para recibir refresh_token
    prompt: 'consent',        // fuerza a Google a reemitirlo cada vez, no solo la primera
    include_granted_scopes: 'true',
    state,
  });

  res.writeHead(302, { Location: `${GOOGLE_AUTH_URL}?${params.toString()}` });
  res.end();
}
