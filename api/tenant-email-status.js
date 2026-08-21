import { supabaseAdmin, resolveTenantFromToken } from '../lib/resolveTenant.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  const tenantId = await resolveTenantFromToken(token);
  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Se revisan las 3 formas de conexion -- OAuth (Google o Microsoft) y
  // SMTP/IMAP con contraseña de aplicacion, nunca mas de una a la vez en el
  // flujo normal de la interfaz.
  const [{ data: oauthRows }, { data: smtpConfig }] = await Promise.all([
    supabaseAdmin
      .from('tenant_email_oauth')
      .select('provider, email_address, status, connected_at')
      .eq('tenant_id', tenantId)
      .in('provider', ['google', 'microsoft']),
    supabaseAdmin
      .from('tenant_email_configs')
      .select('email_address, is_active, updated_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  const active = (oauthRows || []).find(r => r.status === 'active');

  if (active) {
    return res.status(200).json({
      connected: true,
      provider: active.provider,
      email: active.email_address,
      connectedAt: active.connected_at,
    });
  }

  if (smtpConfig) {
    return res.status(200).json({
      connected: true,
      provider: 'smtp',
      email: smtpConfig.email_address,
      connectedAt: smtpConfig.updated_at,
    });
  }

  return res.status(200).json({ connected: false });
}
