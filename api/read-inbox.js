import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mismo patron que ya usa "Code in JavaScript4" en Procesador de Respuestas --
// solo procesamos correos cuyo asunto trae un RFQ ID real de FRIA.
const RFQ_SUBJECT_PATTERN = /FRIA-\d+-[A-Z0-9]{2,6}/;

// Prefijos fijos que usan las notificaciones que FRIA misma genera (preguntas,
// analisis de tarifas, escalaciones) -- ningun carrier real va a escribir un
// asunto que empiece asi por su cuenta, asi que es mas confiable que filtrar
// por remitente (que en pruebas puede coincidir con quien esta simulando ser
// el carrier).
const FRIA_NOTIFICATION_SUBJECT_PREFIXES = [
  'FRIA — Pregunta de carrier',
  'FRIA — Rate Analysis Updated',
  'FRIA — Revisión manual requerida',
];

async function refreshAccessToken(oauth) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: oauth.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await resp.json();
  if (!resp.ok) throw new Error(`refresh failed: ${JSON.stringify(tokens)}`);
  await supabaseAdmin.from('tenant_email_oauth').update({
    access_token: tokens.access_token,
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    status: 'active', last_error: null, updated_at: new Date().toISOString(),
  }).eq('tenant_id', oauth.tenant_id).eq('provider', 'google');
  return tokens.access_token;
}

async function getValidAccessToken(oauth) {
  const expiresAt = new Date(oauth.access_token_expires_at).getTime();
  if (expiresAt - Date.now() > 60 * 1000) return oauth.access_token;
  return refreshAccessToken(oauth);
}

function decodeBase64Url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractPlainText(payload) {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  return '';
}

function getHeader(headers, name) {
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function parseFromHeader(fromValue) {
  const match = fromValue.match(/<(.+)>/);
  const address = match ? match[1] : fromValue.trim();
  const name = match ? fromValue.replace(/<.+>/, '').trim().replace(/"/g, '') : '';
  return { address, name };
}

async function fetchMessage(accessToken, messageId) {
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) return null;
  return resp.json();
}

async function getCurrentHistoryId(accessToken) {
  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await resp.json();
  return profile.historyId;
}

async function processTenantInbox(oauth) {
  const results = [];
  let accessToken;
  try {
    accessToken = await getValidAccessToken(oauth);
  } catch (e) {
    await supabaseAdmin.from('tenant_email_oauth').update({
      status: 'error', last_error: `token refresh: ${e.message}`, updated_at: new Date().toISOString(),
    }).eq('tenant_id', oauth.tenant_id).eq('provider', 'google');
    return results;
  }

  if (!oauth.last_history_id) {
    const currentId = await getCurrentHistoryId(accessToken);
    await supabaseAdmin.from('tenant_email_oauth')
      .update({ last_history_id: currentId, updated_at: new Date().toISOString() })
      .eq('tenant_id', oauth.tenant_id).eq('provider', 'google');
    return results;
  }

  const historyUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
  historyUrl.searchParams.set('startHistoryId', oauth.last_history_id);
  historyUrl.searchParams.set('historyTypes', 'messageAdded');

  const historyResp = await fetch(historyUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const historyData = await historyResp.json();

  if (!historyResp.ok) {
    const currentId = await getCurrentHistoryId(accessToken);
    await supabaseAdmin.from('tenant_email_oauth')
      .update({ last_history_id: currentId, updated_at: new Date().toISOString() })
      .eq('tenant_id', oauth.tenant_id).eq('provider', 'google');
    return results;
  }

  const newHistoryId = historyData.historyId || oauth.last_history_id;
  const messageIds = new Set();
  for (const record of historyData.history || []) {
    for (const added of record.messagesAdded || []) {
      messageIds.add(added.message.id);
    }
  }

  for (const messageId of messageIds) {
    const msg = await fetchMessage(accessToken, messageId);
    if (!msg || !msg.payload) continue;

    // Ignorar lo que la propia cuenta mando (RFQs salientes) -- solo nos
    // interesan las respuestas que SI llegaron de afuera.
    if (msg.labelIds && msg.labelIds.includes('SENT')) continue;

    const subject = getHeader(msg.payload.headers, 'Subject');
    if (!RFQ_SUBJECT_PATTERN.test(subject)) continue; // no es respuesta a un RFQ de FRIA

    // Ignorar las notificaciones que FRIA misma genera -- se identifican por
    // su propio patron de asunto, no por quien las mando.
    if (FRIA_NOTIFICATION_SUBJECT_PREFIXES.some((prefix) => subject.startsWith(prefix))) continue;

    const fromRaw = getHeader(msg.payload.headers, 'From');
    const { address, name } = parseFromHeader(fromRaw);
    const text = extractPlainText(msg.payload);

    results.push({
      tenant_id: oauth.tenant_id,
      subject,
      from: { value: [{ address, name }] },
      text,
      messageId,
    });
  }

  await supabaseAdmin.from('tenant_email_oauth')
    .update({ last_history_id: newHistoryId, updated_at: new Date().toISOString() })
    .eq('tenant_id', oauth.tenant_id).eq('provider', 'google');

  return results;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-fria-secret'];
  if (authHeader !== process.env.FRIA_INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: connections, error } = await supabaseAdmin
    .from('tenant_email_oauth')
    .select('*')
    .eq('provider', 'google')
    .eq('status', 'active');

  if (error) {
    return res.status(500).json({ error: 'Failed to load tenant connections', details: error.message });
  }

  const allResults = [];
  for (const oauth of connections) {
    try {
      const items = await processTenantInbox(oauth);
      allResults.push(...items);
    } catch (e) {
      console.error(`read-inbox error for tenant ${oauth.tenant_id}:`, e);
    }
  }

  return res.status(200).json(allResults);
}
