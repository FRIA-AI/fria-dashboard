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

  const { data: oauth, error } = await supabaseAdmin
    .from('tenant_email_oauth')
    .select('email_address, status, connected_at')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google')
    .limit(1)
    .single();

  if (error || !oauth || oauth.status !== 'active') {
    return res.status(200).json({ connected: false });
  }

  return res.status(200).json({
    connected: true,
    email: oauth.email_address,
    connectedAt: oauth.connected_at,
  });
}
