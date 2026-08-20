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

  // Se revisan ambos proveedores -- el tenant puede haber conectado Gmail o
  // Outlook, nunca los dos a la vez en el flujo normal de la interfaz.
  const { data: rows } = await supabaseAdmin
    .from('tenant_email_oauth')
    .select('provider, email_address, status, connected_at')
    .eq('tenant_id', tenantId)
    .in('provider', ['google', 'microsoft']);

  const active = (rows || []).find(r => r.status === 'active');

  if (!active) {
    return res.status(200).json({ connected: false });
  }

  return res.status(200).json({
    connected: true,
    provider: active.provider,
    email: active.email_address,
    connectedAt: active.connected_at,
  });
}
