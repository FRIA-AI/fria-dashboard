import { createClient } from '@supabase/supabase-js';
import { hasValidInternalSecret } from '../lib/verifyInternalSecret.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// n8n llama a este endpoint cuando termino de procesar un lote de correos
// entrantes. Solo marca como 'processed' los que siguen 'pending'.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasValidInternalSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
    return res.status(400).json({ error: 'ids must be a non-empty array (max 200)' });
  }
  if (!ids.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
    return res.status(400).json({ error: 'Invalid ids' });
  }

  const { data, error } = await supabaseAdmin
    .from('inbound_emails')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    return res.status(500).json({ error: 'Failed to acknowledge' });
  }

  return res.status(200).json({ acknowledged: (data || []).length });
}
