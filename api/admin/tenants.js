import { supabaseAdmin, resolveFriaStaffFromToken } from '../../lib/resolveTenant.js';

// Copia del lado del servidor de src/lib/plans.js -- a proposito duplicada,
// nunca hay que confiar en que el navegador mande el acceso correcto para
// un plan. Si cambian los planes, hay que actualizar los dos archivos.
const PLAN_ACCESS = {
  starter: { userLimit: 3, quoteLimit: 100, marketIntelligence: false },
  growth: { userLimit: 8, quoteLimit: null, marketIntelligence: true },
  pro: { userLimit: 20, quoteLimit: null, marketIntelligence: true },
  enterprise: { userLimit: null, quoteLimit: null, marketIntelligence: true },
};

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
      .select('id, tenant_id, email, first_name, last_name, role');

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
    // Al cambiar de plan, se derivan y aplican mi_plan, user_limit, y
    // monthly_quote_limit en la misma operacion -- nunca se reciben estos 3
    // directo del cliente, siempre se calculan aqui a partir del plan.
    const { tenantId, plan, miPlan } = req.body || {};
    if (!tenantId) {
      return res.status(400).json({ error: 'Falta tenantId.' });
    }

    const updates = {};

    if (plan !== undefined) {
      if (!PLAN_ACCESS[plan]) {
        return res.status(400).json({ error: `Plan no reconocido: ${plan}` });
      }
      const access = PLAN_ACCESS[plan];
      updates.plan = plan;
      updates.mi_plan = access.marketIntelligence ? 'active' : 'none';
      updates.user_limit = access.userLimit;
      updates.monthly_quote_limit = access.quoteLimit;
    } else if (miPlan !== undefined) {
      // Respaldo -- permite ajustar solo Inteligencia de Mercado sin cambiar
      // de plan completo, por si algun caso puntual lo necesita.
      updates.mi_plan = miPlan;
    }

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
