import { supabaseAdmin, resolveFriaStaffFromToken } from '../../lib/resolveTenant.js';

const VALID_ROLES = ['admin', 'pricing', 'sales', 'readonly'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  const staff = await resolveFriaStaffFromToken(token);
  if (!staff) {
    return res.status(403).json({ error: 'Solo el staff de FRIA puede hacer esto.' });
  }

  const { action } = req.body || {};

  if (action === 'add') {
    const { tenantId, email, firstName, lastName, role } = req.body;
    if (!tenantId || !email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Faltan datos del usuario.' });
    }
    const finalRole = VALID_ROLES.includes(role) ? role : 'sales';
    const dashboardBase = process.env.FRIA_DASHBOARD_URL || 'https://fria-dashboard.vercel.app';

    // Mismo patron que create-tenant.js -- invitar, llenar app_metadata
    // (lo unico que RLS realmente usa), y crear la fila en tenant_users.
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { redirectTo: dashboardBase }
    );
    if (inviteError || !invited?.user) {
      return res.status(500).json({ error: 'No se pudo invitar al usuario.', details: inviteError?.message });
    }

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(invited.user.id, {
      app_metadata: { tenant_id: tenantId, role: finalRole },
    });
    if (metaError) {
      return res.status(500).json({ error: 'No se pudo asignar el tenant al usuario.', details: metaError.message });
    }

    const { error: rowError } = await supabaseAdmin.from('tenant_users').insert({
      tenant_id: tenantId,
      auth_user_id: invited.user.id,
      email: email.trim().toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      role: finalRole,
    });
    if (rowError) {
      return res.status(500).json({ error: 'No se pudo guardar el usuario.', details: rowError.message });
    }

    return res.status(200).json({ success: true });
  }

  if (action === 'updateRole') {
    const { tenantUserId, role } = req.body;
    if (!tenantUserId || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Faltan datos o rol invalido.' });
    }

    // El rol vive en dos lugares -- tenant_users.role (lo que la UI lee) y
    // app_metadata.role (lo unico que RLS realmente usa) -- hay que
    // actualizar los dos o quedarian desincronizados.
    const { data: tu, error: fetchError } = await supabaseAdmin
      .from('tenant_users')
      .select('auth_user_id, tenant_id')
      .eq('id', tenantUserId)
      .single();
    if (fetchError || !tu) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(tu.auth_user_id, {
      app_metadata: { tenant_id: tu.tenant_id, role },
    });
    if (metaError) {
      return res.status(500).json({ error: 'No se pudo actualizar el rol de acceso.', details: metaError.message });
    }

    const { error: updateError } = await supabaseAdmin
      .from('tenant_users')
      .update({ role })
      .eq('id', tenantUserId);
    if (updateError) {
      return res.status(500).json({ error: 'No se pudo actualizar el rol.', details: updateError.message });
    }

    return res.status(200).json({ success: true });
  }

  if (action === 'remove') {
    const { tenantUserId } = req.body;
    if (!tenantUserId) {
      return res.status(400).json({ error: 'Falta tenantUserId.' });
    }

    // Solo se quita su membresia a este tenant -- la cuenta de Supabase Auth
    // en si no se toca, para no afectarla si en el futuro pertenece a otro
    // tenant o si se necesita revertir el cambio.
    const { error } = await supabaseAdmin
      .from('tenant_users')
      .delete()
      .eq('id', tenantUserId);
    if (error) {
      return res.status(500).json({ error: 'No se pudo quitar al usuario.', details: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Accion no reconocida.' });
}
