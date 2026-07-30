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
