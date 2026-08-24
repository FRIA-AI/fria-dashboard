import { supabaseAdmin, resolveFriaStaffFromToken } from '../../lib/resolveTenant.js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  const staff = await resolveFriaStaffFromToken(token);
  if (!staff) {
    return res.status(403).json({ error: 'Solo el staff de FRIA puede ver esto.' });
  }

  if (req.method === 'GET') {
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenants')
      .select('id, company_name, slug, plan, mi_plan, status, created_at')
      .order('created_at', { ascending: false });

    if (tenantsError) {
      return res.status(500).json({ error: 'No se pudieron cargar los tenants.', details: tenantsError.message });
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from('tenant_users')
      .select('tenant_id, email, first_name, last_name, role');

    if (usersError) {
      return res.status(500).json({ error: 'No se pudieron cargar los usuarios.', details: usersError.message });
    }

    const usersByTenant = {};
    (users || []).forEach(u => {
      if (!usersByTenant[u.tenant_id]) usersByTenant[u.tenant_id] = [];
      usersByTenant[u.tenant_id].push(u);
    });

    const result = (tenants || []).map(t => ({ ...t, users: usersByTenant[t.id] || [] }));
    return res.status(200).json({ tenants: result });
  }

  if (req.method === 'POST') {
    // Actualiza plan y/o mi_plan de un tenant especifico -- unico cambio que
    // esta pantalla permite hacer, a proposito: es la accion real que el
    // staff necesita (dar de alta o subir de plan a un tenant), no un editor
    // general del tenant.
    const { tenantId, plan, miPlan } = req.body || {};
    if (!tenantId) {
      return res.status(400).json({ error: 'Falta tenantId.' });
    }

    const updates = {};
    if (plan !== undefined) updates.plan = plan;
    if (miPlan !== undefined) updates.mi_plan = miPlan;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar.' });
    }

    const { error } = await supabaseAdmin
      .from('tenants')
      .update(updates)
      .eq('id', tenantId);

    if (error) {
      return res.status(500).json({ error: 'No se pudo actualizar.', details: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
