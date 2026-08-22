import { supabaseAdmin, resolveTenantAdminFromToken } from '../lib/resolveTenant.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  const tenantId = await resolveTenantAdminFromToken(token);
  if (!tenantId) {
    return res.status(403).json({ error: 'Solo el Admin del tenant puede editar los Términos y Condiciones.' });
  }

  const { customTerms } = req.body || {};

  // customTerms puede ser null/'' explicito para volver al texto por
  // defecto de FRIA -- no se exige contenido, es una decision valida.
  const cleanTerms = typeof customTerms === 'string' && customTerms.trim() ? customTerms.trim() : null;

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ custom_terms_conditions: cleanTerms })
    .eq('id', tenantId);

  if (error) {
    return res.status(500).json({ error: 'No se pudo guardar.', details: error.message });
  }

  return res.status(200).json({ success: true, customTerms: cleanTerms });
}
