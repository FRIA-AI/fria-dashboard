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

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('logo_url, custom_terms_conditions')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    return res.status(200).json({ logoUrl: null, customTerms: null });
  }

  return res.status(200).json({
    logoUrl: tenant.logo_url || null,
    customTerms: tenant.custom_terms_conditions || null,
  });
}
