import { createClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mismo patron que ya usa "Code in JavaScript4" en Procesador de Respuestas --
// solo procesamos correos cuyo asunto trae un RFQ ID real de FRIA.
const RFQ_SUBJECT_PATTERN = /FRIA-\d+-[A-Z0-9]{2,6}/;

// Prefijos fijos que usan las notificaciones que FRIA misma genera -- ningun
// carrier real va a escribir un asunto que empiece asi por su cuenta, asi
// que es mas confiable que filtrar por remitente (que en pruebas puede
// coincidir con quien esta simulando ser el carrier).
const FRIA_NOTIFICATION_SUBJECT_PREFIXES = [
  'FRIA — Pregunta de carrier',
  'FRIA — Rate Analysis Updated',
  'FRIA — Revisión manual requerida',
  'FRIA — Respuesta de carrier requiere su revisión',
  'FRIA — Respuesta requiere confirmación',
  'FRIA — Pregunta respondida automáticamente',
  'FRIA — Contacto de respaldo agregado',
];

async function refreshGoogleAccessToken(oauth) {
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

async function getValidGoogleAccessToken(oauth) {
  const expiresAt = new Date(oauth.access_token_expires_at).getTime();
  if (expiresAt - Date.now() > 60 * 1000) return oauth.access_token;
  return refreshGoogleAccessToken(oauth);
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

async function processGoogleTenantInbox(oauth) {
  const results = [];
  let accessToken;
  try {
    accessToken = await getValidGoogleAccessToken(oauth);
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

// --- Microsoft Graph -- misma logica, mecanismo de sincronizacion distinto ---
// Gmail usa un historyId incremental; Microsoft Graph usa "delta query": la
// primera llamada regresa una @odata.deltaLink (una URL completa, no solo un
// ID) que hay que reusar tal cual en la siguiente llamada para traer solo lo
// nuevo. Por eso el mismo campo last_history_id guarda cosas distintas segun
// el proveedor -- para Google es un ID corto, para Microsoft es la URL completa.

async function refreshMicrosoftAccessToken(oauth) {
  const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: oauth.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await resp.json();
  if (!resp.ok) throw new Error(`refresh failed: ${JSON.stringify(tokens)}`);
  await supabaseAdmin.from('tenant_email_oauth').update({
    access_token: tokens.access_token,
    ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    status: 'active', last_error: null, updated_at: new Date().toISOString(),
  }).eq('tenant_id', oauth.tenant_id).eq('provider', 'microsoft');
  return tokens.access_token;
}

async function getValidMicrosoftAccessToken(oauth) {
  const expiresAt = new Date(oauth.access_token_expires_at).getTime();
  if (expiresAt - Date.now() > 60 * 1000) return oauth.access_token;
  return refreshMicrosoftAccessToken(oauth);
}

// Convierte el HTML del cuerpo de un correo de Outlook a texto plano simple
// -- suficiente para lo que el resto del pipeline necesita, sin traer una
// libreria nueva solo para esto.
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

async function processMicrosoftTenantInbox(oauth) {
  const results = [];
  let accessToken;
  try {
    accessToken = await getValidMicrosoftAccessToken(oauth);
  } catch (e) {
    await supabaseAdmin.from('tenant_email_oauth').update({
      status: 'error', last_error: `token refresh: ${e.message}`, updated_at: new Date().toISOString(),
    }).eq('tenant_id', oauth.tenant_id).eq('provider', 'microsoft');
    return results;
  }

  // Primera sincronizacion -- solo se establece el punto de partida (delta
  // link), no se procesa nada todavia. Mismo criterio que el lado de Google:
  // evitar procesar de golpe todo el historial de la bandeja al conectar.
  let syncUrl = oauth.last_history_id
    || 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$select=subject,from,body,isDraft';

  const isFirstSync = !oauth.last_history_id;
  let newDeltaLink = null;
  const rawMessages = [];

  // Delta query puede venir paginado (@odata.nextLink) antes de llegar a la
  // pagina final con @odata.deltaLink -- hay que seguir la cadena completa.
  while (syncUrl) {
    const resp = await fetch(syncUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await resp.json();

    if (!resp.ok) {
      // deltaLink vencido o invalido -- se reinicia la sincronizacion desde cero
      // la proxima vez, en vez de quedar atorado repitiendo el mismo error.
      await supabaseAdmin.from('tenant_email_oauth')
        .update({ last_history_id: null, updated_at: new Date().toISOString() })
        .eq('tenant_id', oauth.tenant_id).eq('provider', 'microsoft');
      return results;
    }

    rawMessages.push(...(data.value || []));
    syncUrl = data['@odata.nextLink'] || null;
    if (data['@odata.deltaLink']) newDeltaLink = data['@odata.deltaLink'];
  }

  await supabaseAdmin.from('tenant_email_oauth')
    .update({ last_history_id: newDeltaLink, updated_at: new Date().toISOString() })
    .eq('tenant_id', oauth.tenant_id).eq('provider', 'microsoft');

  if (isFirstSync) return results; // solo se establecio el punto de partida

  for (const msg of rawMessages) {
    if (msg.isDraft) continue;

    const subject = msg.subject || '';
    if (!RFQ_SUBJECT_PATTERN.test(subject)) continue;
    if (FRIA_NOTIFICATION_SUBJECT_PREFIXES.some((prefix) => subject.startsWith(prefix))) continue;

    const address = msg.from?.emailAddress?.address || '';
    const name = msg.from?.emailAddress?.name || '';
    const rawBody = msg.body?.content || '';
    const text = msg.body?.contentType === 'html' ? stripHtml(rawBody) : rawBody;

    results.push({
      tenant_id: oauth.tenant_id,
      subject,
      from: { value: [{ address, name }] },
      text,
      messageId: msg.id,
    });
  }

  return results;
}

// --- IMAP (SMTP + contrasena de aplicacion, sin OAuth) -----------------
// Aqui no hay historyId ni deltaLink -- se usa el propio estado "no leido"
// del correo como marcador: se buscan solo los mensajes sin leer, y se
// marcan como leidos justo despues de procesarlos. Es el mismo criterio que
// seguiria una persona revisando la bandeja a mano.
async function processImapTenantInbox(config) {
  const results = [];
  const client = new ImapFlow({
    host: config.imap_host, port: config.imap_port, secure: config.imap_secure,
    auth: { user: config.smtp_user, pass: config.smtp_password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ seen: false });
      for (const uid of uids) {
        const { content } = await client.download(uid);
        const parsed = await simpleParser(content);

        const subject = parsed.subject || '';
        const isRfqSubject = RFQ_SUBJECT_PATTERN.test(subject);
        const isFriaNotification = FRIA_NOTIFICATION_SUBJECT_PREFIXES.some((prefix) => subject.startsWith(prefix));

        if (isRfqSubject && !isFriaNotification) {
          const fromAddr = parsed.from?.value?.[0] || {};
          results.push({
            tenant_id: config.tenant_id,
            subject,
            from: { value: [{ address: fromAddr.address || '', name: fromAddr.name || '' }] },
            text: parsed.text || '',
            messageId: parsed.messageId || String(uid),
          });
        }

        // Se marca como leido en cualquier caso (sea RFQ o no) para no
        // volver a revisarlo la proxima corrida.
        await client.messageFlagsAdd(uid, ['\\Seen']);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    await supabaseAdmin.from('tenant_email_configs').update({
      last_error: `imap: ${e.message}`, updated_at: new Date().toISOString(),
    }).eq('tenant_id', config.tenant_id);
    return results;
  }

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
    .in('provider', ['google', 'microsoft'])
    .eq('status', 'active');

  if (error) {
    return res.status(500).json({ error: 'Failed to load tenant connections', details: error.message });
  }

  const allResults = [];
  for (const oauth of connections) {
    try {
      const items = oauth.provider === 'microsoft'
        ? await processMicrosoftTenantInbox(oauth)
        : await processGoogleTenantInbox(oauth);
      allResults.push(...items);
    } catch (e) {
      console.error(`read-inbox error for tenant ${oauth.tenant_id} (${oauth.provider}):`, e);
    }
  }

  // Tenants conectados por SMTP + contrasena de aplicacion (sin OAuth) --
  // solo los que ya tienen imap_host guardado, es decir, los que pasaron la
  // prueba real de conexion al conectarse desde Configuracion.
  const { data: smtpConfigs } = await supabaseAdmin
    .from('tenant_email_configs')
    .select('*')
    .eq('is_active', true)
    .not('imap_host', 'is', null);

  for (const config of smtpConfigs || []) {
    try {
      const items = await processImapTenantInbox(config);
      allResults.push(...items);
    } catch (e) {
      console.error(`read-inbox error for tenant ${config.tenant_id} (imap):`, e);
    }
  }

  return res.status(200).json(allResults);
}
