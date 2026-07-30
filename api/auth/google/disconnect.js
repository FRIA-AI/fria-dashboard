import { supabaseAdmin, resolveTenantFromToken } from '../../lib/resolveTenant.js';

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

  const { data: oauth, error: fetchError } = await supabaseAdmin
    .from('tenant_email_oauth')
    .select('refresh_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google')
    .limit(1)
    .single();

  if (fetchError || !oauth) {
    return res.status(404).json({ error: 'No hay conexion activa para este tenant' });
  }

  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: oauth.refresh_token }),
    });
  } catch (e) {
    console.error('Error revocando token con Google (se continua de todos modos):', e);
  }

  const { error: updateError } = await supabaseAdmin
    .from('tenant_email_oauth')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('provider', 'google');

  if (updateError) {
    return res.status(500).json({ error: 'Fallo al actualizar el estado', details: updateError.message });
  }

  return res.status(200).json({ success: true });
}
