// FRIA Actions API — DESACTIVADO temporalmente.
// Reescribir conectado a Supabase cuando se reconstruya Chat (ver Sección 11.4
// del business case). El original hablaba directo con Airtable y tenía un
// token expuesto en el código como fallback — no reactivar esta lógica sin
// antes moverla a Supabase con RLS por tenant.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(503).json({
    success: false,
    error: 'Chat actions are temporarily disabled while this feature is rebuilt on Supabase.',
  });
}
