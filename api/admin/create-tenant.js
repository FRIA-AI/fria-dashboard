import { supabaseAdmin, resolveFriaStaffFromToken } from '../../lib/resolveTenant.js';
import sharp from 'sharp';

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

const VALID_ROLES = ['admin', 'pricing', 'sales', 'readonly'];
const VALID_PLANS = ['starter', 'growth', 'pro', 'enterprise'];

// Tamano estandar al que se normaliza CUALQUIER logo subido -- formato
// ancho tipo membrete (proporcion 24:7). Asi el PDF de venta siempre puede
// confiar en la misma forma exacta, sin importar que tan raro sea el
// archivo original que suba el cliente.
const LOGO_CANVAS_W = 480;
const LOGO_CANVAS_H = 140;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  const staff = await resolveFriaStaffFromToken(token);
  if (!staff) {
    return res.status(403).json({ error: 'Solo el staff de FRIA puede dar de alta un tenant.' });
  }

  const { companyName, primaryEmail, country, plan, users, logoBase64, logoContentType } = req.body || {};

  if (!companyName || !primaryEmail) {
    return res.status(400).json({ error: 'Falta companyName o primaryEmail.' });
  }
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'Se necesita al menos un usuario inicial.' });
  }
  for (const u of users) {
    if (!u.email || !u.firstName || !u.lastName) {
      return res.status(400).json({ error: 'Cada usuario necesita email, firstName y lastName.' });
    }
    if (u.role && !VALID_ROLES.includes(u.role)) {
      return res.status(400).json({ error: `Rol invalido: ${u.role}` });
    }
  }
  const finalPlan = VALID_PLANS.includes(plan) ? plan : 'starter';

  // Slug unico -- si ya existe, se le agrega un sufijo corto en vez de fallar.
  let slug = slugify(companyName) || 'tenant';
  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('slug')
    .like('slug', `${slug}%`);
  if (existing && existing.length) {
    const taken = new Set(existing.map(t => t.slug));
    if (taken.has(slug)) {
      let n = 2;
      while (taken.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({
      company_name: companyName,
      slug,
      primary_email: primaryEmail,
      country: country || 'MX',
      plan: finalPlan,
      status: 'trial',
    })
    .select('id, company_name, slug')
    .single();

  if (tenantError || !tenant) {
    return res.status(500).json({ error: 'No se pudo crear el tenant.', details: tenantError?.message });
  }

  // Logo del tenant -- se sube a Storage y se guarda la URL publica en
  // tenants.logo_url. Si falla, no se detiene el alta del tenant -- se
  // reporta el error en la respuesta para que la pantalla lo muestre
  // (result.logoError, que el frontend ya sabia leer, solo nunca llegaba).
  let logoError = null;
  if (logoBase64 && logoContentType) {
    try {
      const inputBuffer = Buffer.from(logoBase64, 'base64');

      // Se ajusta dentro del lienzo (sin recortar ni deformar), centrado,
      // con fondo transparente -- sea cual sea la forma original.
      const normalizedBuffer = await sharp(inputBuffer)
        .resize(LOGO_CANVAS_W, LOGO_CANVAS_H, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer();

      const path = `${tenant.id}/logo.png`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('tenant-logos')
        .upload(path, normalizedBuffer, { contentType: 'image/png', upsert: true });

      if (uploadError) {
        logoError = uploadError.message;
      } else {
        const { data: publicUrlData } = supabaseAdmin.storage.from('tenant-logos').getPublicUrl(path);
        const { error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ logo_url: publicUrlData.publicUrl })
          .eq('id', tenant.id);
        if (updateError) logoError = updateError.message;
      }
    } catch (e) {
      logoError = e.message;
    }
  }

  const dashboardBase = process.env.FRIA_DASHBOARD_URL || 'https://fria-dashboard.vercel.app';
  const results = [];

  for (const u of users) {
    const role = u.role || 'sales';
    try {
      const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        u.email.trim().toLowerCase(),
        { redirectTo: dashboardBase }
      );
      if (inviteError || !invited?.user) {
        results.push({ email: u.email, success: false, step: 'invite', error: inviteError?.message });
        continue;
      }

      // app_metadata (tenant_id/role) es lo unico que RLS realmente usa --
      // inviteUserByEmail NO lo llena, hace falta esta llamada aparte.
      const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(invited.user.id, {
        app_metadata: { tenant_id: tenant.id, role },
      });
      if (metaError) {
        results.push({ email: u.email, success: false, step: 'app_metadata', error: metaError.message });
        continue;
      }

      const { error: rowError } = await supabaseAdmin.from('tenant_users').insert({
        tenant_id: tenant.id,
        auth_user_id: invited.user.id,
        email: u.email.trim().toLowerCase(),
        first_name: u.firstName,
        last_name: u.lastName,
        role,
      });
      if (rowError) {
        results.push({ email: u.email, success: false, step: 'tenant_users', error: rowError.message });
        continue;
      }

      results.push({ email: u.email, success: true });
    } catch (e) {
      results.push({ email: u.email, success: false, step: 'unexpected', error: e.message });
    }
  }

  return res.status(200).json({ tenant, results, logoError });
}
