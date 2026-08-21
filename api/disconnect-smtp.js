import { supabaseAdmin, resolveTenantFromToken } from '../lib/resolveTenant.js';

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

  const { error } = await supabaseAdmin
    .from('tenant_email_configs')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  if (error) {
    return res.status(500).json({ error: 'Fallo al desconectar', details: error.message });
  }

  return res.status(200).json({ success: true });
}
