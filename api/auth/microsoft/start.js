import crypto from 'crypto';
import { resolveTenantFromToken } from '../../../lib/resolveTenant.js';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
// offline_access es obligatorio en el modelo de Microsoft para recibir
// refresh_token -- es el equivalente a access_type=offline de Google.
const SCOPES = [
  'offline_access',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/User.Read',
].join(' ');

function signState(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', process.env.MICROSOFT_OAUTH_STATE_SECRET)
    .update(b64)
    .digest('base64url');
  return `${b64}.${hmac}`;
}

export default async function handler(req, res) {
  // Mismo patron de seguridad que google/start.js -- el tenant se resuelve
  // desde la sesion verificada de Supabase, nunca desde un parametro que
  // el cliente pueda manipular directamente.
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
    client_id: process.env.MICROSOFT_CLIENT_ID,
    redirect_uri: process.env.MICROSOFT_OAUTH_REDIRECT_URI,
    response_type: 'code',
    response_mode: 'query',
    scope: SCOPES,
    state,
    prompt: 'consent', // fuerza a Microsoft a reemitir el refresh_token cada vez
  });

  res.writeHead(302, { Location: `${MICROSOFT_AUTH_URL}?${params.toString()}` });
  res.end();
}
