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
    .createHmac('sha256', process.env.MICROSOFT_OAUTH_STATE_SECRET)
    .update(b64)
    .digest('base64url');

  if (sig !== expectedSig) throw new Error('state inválido');

  const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
  if (Date.now() - payload.ts > STATE_MAX_AGE_MS) throw new Error('state expirado');

  return payload;
}

export default async function handler(req, res) {
  const { code, state, error: msError } = req.query;
  const dashboardBase = process.env.FRIA_DASHBOARD_URL || 'https://fria-dashboard.vercel.app';

  if (msError) {
    res.writeHead(302, { Location: `${dashboardBase}/?connected=cancelled` });
    return res.end();
  }

  let tenantId;
  try {
    ({ tenantId } = verifyState(state));
  } catch (e) {
    res.writeHead(302, { Location: `${dashboardBase}/?connected=error&reason=state` });
    return res.end();
  }

  try {
    const tokenResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        redirect_uri: process.env.MICROSOFT_OAUTH_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResp.json();
    if (!tokenResp.ok) throw new Error(`Microsoft token exchange failed: ${JSON.stringify(tokens)}`);
    if (!tokens.refresh_token) throw new Error('Microsoft no devolvió refresh_token — revisa el scope offline_access en start.js');

    const profileResp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResp.json();
    // Las cuentas personales de Outlook.com solo traen userPrincipalName en
    // algunos casos, y 'mail' en otros -- se revisan ambos por seguridad.
    const emailAddress = profile.mail || profile.userPrincipalName;

    const { error: dbError } = await supabase
      .from('tenant_email_oauth')
      .upsert({
        tenant_id: tenantId,
        provider: 'microsoft',
        email_address: emailAddress,
        scopes: tokens.scope,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        last_history_id: null, // aqui se guarda el deltaLink de Graph una vez que arranca la primera sincronizacion
        status: 'active',
        last_error: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,provider' });

    if (dbError) throw dbError;

    res.writeHead(302, { Location: `${dashboardBase}/?connected=success` });
    res.end();
  } catch (e) {
    console.error('Microsoft OAuth callback error:', e);
    res.writeHead(302, { Location: `${dashboardBase}/?connected=error` });
    res.end();
  }
}
