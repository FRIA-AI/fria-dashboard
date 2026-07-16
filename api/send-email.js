import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Este endpoint es llamado por n8n (o cualquier workflow interno) para mandar
// un correo usando la configuracion SMTP real del tenant correspondiente,
// en vez de una credencial fija dentro de n8n. Ver Seccion 12 del business case.

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Autenticacion simple entre n8n y este endpoint
  const authHeader = req.headers['x-fria-secret'];
  if (authHeader !== process.env.FRIA_INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tenantId, to, cc, replyTo, subject, html } = req.body;

  if (!tenantId || !to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: tenantId, to, subject, html' });
  }

  try {
    // service_role se salta RLS a proposito -- este endpoint SI necesita ver
    // la configuracion de cualquier tenant, no solo uno.
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
        error: `No active email config found for tenant ${tenantId}`,
        debug: configError ? configError.message : 'no error object, but no row returned',
      });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_password,
      },
    });

    const info = await transporter.sendMail({
      from: `"${config.display_name}" <${config.email_address}>`,
      to,
      cc: cc || undefined,
      replyTo: replyTo || config.email_address,
      subject,
      html,
    });

    // Actualiza cuando se uso por ultima vez, para monitoreo futuro
    await supabaseAdmin
      .from('tenant_email_configs')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', config.id);

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
}
