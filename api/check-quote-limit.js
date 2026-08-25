import { supabaseAdmin, resolveTenantFromToken } from '../lib/resolveTenant.js';

// Definicion de "cotizacion" para este limite: 1 solicitud que el usuario le
// hace a FRIA (1 fila en public.quotes) -- sin importar a cuantos carriers
// se les mando el RFQ por debajo, ni cuantos contestaron. Confirmado con
// Adolfo el 24 de agosto de 2026.

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

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('monthly_quote_limit')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    return res.status(500).json({ error: 'No se pudo verificar el límite.', details: tenantError?.message });
  }

  const limit = tenant.monthly_quote_limit;

  // null = sin limite (Growth en adelante) -- no hace falta contar nada.
  if (limit === null || limit === undefined) {
    return res.status(200).json({ withinLimit: true, used: null, limit: null });
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error: countError } = await supabaseAdmin
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', startOfMonth.toISOString());

  if (countError) {
    return res.status(500).json({ error: 'No se pudo contar las cotizaciones.', details: countError.message });
  }

  return res.status(200).json({ withinLimit: count < limit, used: count, limit });
}
