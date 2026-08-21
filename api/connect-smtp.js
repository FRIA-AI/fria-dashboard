import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { supabaseAdmin, resolveTenantFromToken } from '../lib/resolveTenant.js';

// Valores fijos por proveedor conocido -- el usuario nunca los ve ni los
// escribe, solo elige el proveedor y da su correo + contraseña de aplicacion.
// Para 'other' el propio usuario da estos 6 valores a mano.
const PRESETS = {
  outlook: {
    smtp: { host: 'smtp.office365.com', port: 587, secure: false },
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
  yahoo: {
    smtp: { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  },
  zoho: {
    smtp: { host: 'smtp.zoho.com', port: 587, secure: false },
    imap: { host: 'imap.zoho.com', port: 993, secure: true },
  },
};

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

  const { provider, emailAddress, appPassword, displayName, manual } = req.body;
  if (!emailAddress || !appPassword) {
    return res.status(400).json({ error: 'Falta correo o contraseña de aplicación.' });
  }

  let smtp, imap;
  if (provider === 'other') {
    if (!manual?.smtpHost || !manual?.smtpPort || !manual?.imapHost || !manual?.imapPort) {
      return res.status(400).json({ error: 'Faltan datos del servidor -- pídeselos a quien administra tu correo.' });
    }
    smtp = { host: manual.smtpHost, port: Number(manual.smtpPort), secure: !!manual.smtpSecure };
    imap = { host: manual.imapHost, port: Number(manual.imapPort), secure: manual.imapSecure !== false };
  } else if (PRESETS[provider]) {
    smtp = PRESETS[provider].smtp;
    imap = PRESETS[provider].imap;
  } else {
    return res.status(400).json({ error: 'Proveedor no reconocido.' });
  }

  // 1) Probar SMTP (envio) de verdad antes de guardar nada -- verify() hace
  // el saludo/autenticacion real contra el servidor, sin mandar ningun correo.
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host, port: smtp.port, secure: smtp.secure,
      auth: { user: emailAddress, pass: appPassword },
    });
    await transporter.verify();
  } catch (e) {
    return res.status(400).json({
      error: 'No se pudo conectar para enviar correo. Revisa el correo, la contraseña, y los datos del servidor si elegiste "Otro".',
      details: e.message,
    });
  }

  // 2) Probar IMAP (lectura) de verdad antes de guardar nada.
  try {
    const client = new ImapFlow({
      host: imap.host, port: imap.port, secure: imap.secure,
      auth: { user: emailAddress, pass: appPassword },
      logger: false,
    });
    await client.connect();
    await client.logout();
  } catch (e) {
    return res.status(400).json({
      error: 'La conexión para enviar correo funcionó, pero la de leer la bandeja falló. Revisa los datos de IMAP o los permisos de la contraseña de aplicación.',
      details: e.message,
    });
  }

  // Ambas pruebas pasaron -- ahora si se guarda.
  const { error: dbError } = await supabaseAdmin
    .from('tenant_email_configs')
    .upsert({
      tenant_id: tenantId,
      email_address: emailAddress,
      display_name: displayName || null,
      smtp_host: smtp.host,
      smtp_port: smtp.port,
      smtp_secure: smtp.secure,
      smtp_user: emailAddress,
      smtp_password: appPassword,
      imap_host: imap.host,
      imap_port: imap.port,
      imap_secure: imap.secure,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

  if (dbError) {
    return res.status(500).json({ error: 'Las credenciales son válidas pero no se pudieron guardar.', details: dbError.message });
  }

  return res.status(200).json({ success: true, email: emailAddress });
}
