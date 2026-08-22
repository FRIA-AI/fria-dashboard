import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Resuelve el tenant_id real a partir de un access token de Supabase Auth,
// verificando primero que el token sea valido. NUNCA confiar en un tenantId
// que venga directo del cliente sin pasar por aqui -- de lo contrario
// cualquiera podria operar sobre un tenant ajeno con solo cambiar un parametro.
export async function resolveTenantFromToken(token) {
  if (!token) return null;

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return null;

  const { data: tenantUser, error: tuError } = await supabaseAdmin
    .from('tenant_users')
    .select('tenant_id')
    .eq('auth_user_id', userData.user.id)
    .single();

  if (tuError || !tenantUser) return null;
  return tenantUser.tenant_id;
}

// Igual que resolveTenantFromToken, pero ademas exige que el usuario tenga
// rol 'admin' dentro de su tenant -- para acciones que solo el admin debe
// poder hacer (ej. editar Terminos y Condiciones del tenant). Devuelve null
// si el usuario no es admin, aunque si pertenezca al tenant.
export async function resolveTenantAdminFromToken(token) {
  if (!token) return null;

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return null;

  const { data: tenantUser, error: tuError } = await supabaseAdmin
    .from('tenant_users')
    .select('tenant_id, role')
    .eq('auth_user_id', userData.user.id)
    .single();

  if (tuError || !tenantUser || tenantUser.role !== 'admin') return null;
  return tenantUser.tenant_id;
}

// Verifica si el usuario del token es staff de FRIA (no ligado a ningun
// tenant). Devuelve la fila de fria_staff si lo es, o null si no.
export async function resolveFriaStaffFromToken(token) {
  if (!token) return null;

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return null;

  const { data: staff, error: staffError } = await supabaseAdmin
    .from('fria_staff')
    .select('id, email, name')
    .eq('auth_user_id', userData.user.id)
    .single();

  if (staffError || !staff) return null;
  return staff;
}
