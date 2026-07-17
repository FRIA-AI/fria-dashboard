import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

function verifyState(state) {
  const [b64, sig] = state.split('.');
  const expectedSig = crypto
    .createHmac('sha256', process.env.GOOGLE_OAUTH_STATE_SECRET)
    .update(b64)
    .digest('base64url');

  if (sig !== expectedSig) throw new Error('state inválido');

  const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
  if (Date.now() - payload.ts > STATE_MAX_AGE_MS) throw new Error('state expirado');

  return payload;
}

export default async function handler(req, res) {
  const { code, state, error: googleError } = req.query;
  const dashboardBase = process.env.FRIA_DASHBOARD_URL || 'https://fria-dashboard.vercel.app';

  if (googleError) {
    res.writeHead(302, { Location: `${dashboardBase}/settings/email?connected=cancelled` });
    return res.end();
  }

  let tenantId;
  try {
    ({ tenantId } = verifyState(state));
  } catch (e) {
    res.writeHead(302, { Location: `${dashboardBase}/settings/email?connected=error&reason=state` });
    return res.end();
  }

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResp.json();
    if (!tokenResp.ok) throw new Error(`Google token exchange failed: ${JSON.stringify(tokens)}`);
    if (!tokens.refresh_token) throw new Error('Google no devolvió refresh_token — revisa access_type/prompt en start.js');

    const profileResp = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResp.json();

    const { error: dbError } = await supabase
      .from('tenant_email_oauth')
      .upsert({
        tenant_id: tenantId,
        provider: 'google',
        email_address: profile.emailAddress,
        scopes: tokens.scope,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: 'active',
        last_error: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,provider' });

    if (dbError) throw dbError;

    res.writeHead(302, { Location: `${dashboardBase}/settings/email?connected=success` });
    res.end();
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.writeHead(302, { Location: `${dashboardBase}/settings/email?connected=error` });
    res.end();
  }
}
Agregar callback de OAuth con Google
