import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Este endpoint es llamado por n8n para mandar un correo usando la
// configuracion real del tenant correspondiente. Intenta primero OAuth
// (Gmail); si el tenant no tiene una conexion OAuth activa, cae a SMTP
// con la configuracion guardada en tenant_email_configs.
// Ver Seccion 12 y 13 del business case.

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getValidGoogleAccessToken(tenantId) {
  const { data: oauth, error } = await supabaseAdmin
    .from('tenant_email_oauth')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (error || !oauth) return null; // sin conexion OAuth -> cae a SMTP

  const expiresAt = new Date(oauth.access_token_expires_at).getTime();
  if (expiresAt - Date.now() > 60 * 1000) {
    return { accessToken: oauth.access_token, emailAddress: oauth.email_address };
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: oauth.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await resp.json();

  if (!resp.ok) {
    await supabaseAdmin.from('tenant_email_oauth')
      .update({ status: 'error', last_error: JSON.stringify(tokens), updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId).eq('provider', 'google');
    return null;
  }

  await supabaseAdmin.from('tenant_email_oauth')
    .update({
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      status: 'active', last_error: null, updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId).eq('provider', 'google');

  return { accessToken: tokens.access_token, emailAddress: oauth.email_address };
}

async function getDisplayName(tenantId, smtpConfig) {
  if (smtpConfig && smtpConfig.display_name) return smtpConfig.display_name;

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('company_name')
    .eq('id', tenantId)
    .single();
  if (tenant && tenant.company_name) return tenant.company_name;

  return 'FRIA'; // ultimo respaldo -- nunca debe tronar por falta de nombre
}

async function sendViaGmailApi({ accessToken, fromDisplayName, fromEmail, to, cc, replyTo, subject, html }) {
  const headers = [`From: "${fromDisplayName}" <${fromEmail}>`, `To: ${to}`];
  if (cc) headers.push(`Cc: ${cc}`);
  headers.push(`Reply-To: ${replyTo || fromEmail}`);
  headers.push(`Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`);
  headers.push('MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8');

  const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + html)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const result = await resp.json();
  if (!resp.ok) throw new Error(`Gmail send failed: ${JSON.stringify(result)}`);
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-fria-secret'];
  if (authHeader !== process.env.FRIA_INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tenantId, to, cc, replyTo, subject, html } = req.body;
  if (!tenantId || !to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: tenantId, to, subject, html' });
  }

  try {
    const googleAuth = await getValidGoogleAccessToken(tenantId);

    if (googleAuth) {
      const displayName = await getDisplayName(tenantId, null);
      const info = await sendViaGmailApi({
        accessToken: googleAuth.accessToken,
        fromDisplayName: displayName,
        fromEmail: googleAuth.emailAddress,
        to, cc, replyTo, subject, html,
      });
      return res.status(200).json({ success: true, messageId: info.id, method: 'oauth' });
    }

    // --- Sin conexion OAuth -- mismo flujo SMTP que ya tenias, sin cambios ---
    const { data: config, error: configError } = await supabaseAdmin
      .from('tenant_email_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (configError || !config) {
      console.error('tenant_email_configs query error:', JSON.stringify(configError));
      return res.status(404).json({
        error: `No active email connection for tenant ${tenantId} (ni OAuth ni SMTP)`,
        debug: configError ? configError.message : 'no error object, but no row returned',
      });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: { user: config.smtp_user, pass: config.smtp_password },
    });

    const info = await transporter.sendMail({
      from: `"${config.display_name}" <${config.email_address}>`,
      to,
      cc: cc || undefined,
      replyTo: replyTo || config.email_address,
      subject,
      html,
    });

    await supabaseAdmin
      .from('tenant_email_configs')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', config.id);

    return res.status(200).json({ success: true, messageId: info.messageId, method: 'smtp' });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
}
