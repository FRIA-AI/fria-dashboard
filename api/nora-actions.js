// NORA Actions API — executes approved tool calls
// Called by chat.js after user approves an action plan

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || 'pat47WzGdiLj2M7Bu.2d4eaeb508f4071039950f961c2620f0e7c4578ca5a53e6be32193fbd23c8f8e';
const BASE_ID = 'app8TKlzHRkSiHgnH';
const AIRTABLE_API = 'https://api.airtable.com/v0';

const N8N_WEBHOOKS = {
  rfq: 'https://roadnlmx.app.n8n.cloud/webhook/fd5bb4ce-a3d1-44e7-986d-c9e84aae3391',
  tarifarios: 'https://roadnlmx.app.n8n.cloud/webhook/nora-tarifarios',
};

const airtableHeaders = {
  'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, input } = req.body;

  try {
    let result;

    switch (action) {
      case 'request_quote':
        result = await requestQuote(input);
        break;
      case 'get_quotes_by_lane':
        result = await getQuotesByLane(input);
        break;
      case 'create_historical_rate':
        result = await createHistoricalRate(input);
        break;
      case 'add_carrier':
        result = await addCarrier(input);
        break;
      case 'update_carrier':
        result = await updateCarrier(input);
        break;
      case 'execute_n8n_workflow':
        result = await executeN8nWorkflow(input);
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error(`Action ${action} failed:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Action Handlers ──────────────────────────────────────────────

async function requestQuote({ origin, destination, equipment, notes, userEmail }) {
  const payload = {
    body: {
      message: `Please quote: ${equipment} from ${origin} to ${destination}. ${notes || ''}`.trim(),
      UserEmail: userEmail || 'adolfo.romero@noatumlogistics.com',
      origin,
      destination,
      equipment,
      notes: notes || '',
      source: 'nora-chat',
    },
  };

  const res = await fetch(N8N_WEBHOOKS.rfq, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`n8n RFQ webhook failed: ${res.status}`);
  const data = await res.json();
  return { message: `RFQ triggered successfully for ${equipment} ${origin} → ${destination}`, data };
}

async function getQuotesByLane({ origin, destination, equipment, limit = 20 }) {
  let formula = '';
  const conditions = [];

  if (origin) conditions.push(`SEARCH(LOWER("${origin}"), LOWER({Origin}))`);
  if (destination) conditions.push(`SEARCH(LOWER("${destination}"), LOWER({Destination}))`);
  if (equipment) conditions.push(`SEARCH(LOWER("${equipment}"), LOWER({Equipment}))`);

  if (conditions.length > 1) formula = `AND(${conditions.join(',')})`;
  else if (conditions.length === 1) formula = conditions[0];

  let url = `${AIRTABLE_API}/${BASE_ID}/${encodeURIComponent('Quotes')}?pageSize=${limit}&sort[0][field]=Response Date&sort[0][direction]=desc`;
  if (formula) url += `&filterByFormula=${encodeURIComponent(formula)}`;

  const res = await fetch(url, { headers: airtableHeaders });
  if (!res.ok) throw new Error(`Airtable error: ${res.status}`);

  const data = await res.json();
  const records = data.records.map(r => ({ id: r.id, ...r.fields }));
  return { count: records.length, records };
}

async function createHistoricalRate({
  carrierName, origin, destination, equipment,
  price, currency, transitTime, validFrom, validTo, source, notes
}) {
  const fields = {
    'Carrier Name': carrierName,
    'Origin': origin,
    'Destination': destination,
    'Equipment': equipment,
    'Price': price,
    'Currency': currency || 'MXN',
    'Transit Time': transitTime || '',
    'Valid From': validFrom || new Date().toISOString().split('T')[0],
    'Valid To': validTo || '',
    'Source': source || 'NORA Chat',
    'Notes': notes || '',
  };

  const res = await fetch(`${AIRTABLE_API}/${BASE_ID}/${encodeURIComponent('Historical Rates')}`, {
    method: 'POST',
    headers: airtableHeaders,
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Airtable error: ${JSON.stringify(err)}`);
  }

  const created = await res.json();
  return { message: `Historical rate created for ${carrierName} on ${origin} → ${destination}`, id: created.id };
}

async function addCarrier({
  carrierName, equipmentTypes, yards, serviceType,
  mainContact, mainEmail, ccContact, ccEmail, language, notes
}) {
  const fields = {
    'Carrier Name': carrierName,
    'Equipment Types': equipmentTypes || [],
    'Yards': yards || '',
    'Service Type': serviceType || [],
    'Main Contact': mainContact || '',
    'Main Email': mainEmail,
    'CC Contact': ccContact || '',
    'CC Email': ccEmail || '',
    'Language': language || 'Spanish',
    'Active/Inactive': 'Active',
    'Notes': notes || '',
  };

  const res = await fetch(`${AIRTABLE_API}/${BASE_ID}/${encodeURIComponent('Carriers')}`, {
    method: 'POST',
    headers: airtableHeaders,
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Airtable error: ${JSON.stringify(err)}`);
  }

  const created = await res.json();
  return { message: `Carrier "${carrierName}" added successfully`, id: created.id };
}

async function updateCarrier({ carrierName, fields }) {
  // First find the carrier record ID
  const searchUrl = `${AIRTABLE_API}/${BASE_ID}/${encodeURIComponent('Carriers')}?filterByFormula=${encodeURIComponent(`{Carrier Name}="${carrierName}"`)}`;
  const searchRes = await fetch(searchUrl, { headers: airtableHeaders });
  if (!searchRes.ok) throw new Error(`Airtable search error: ${searchRes.status}`);

  const searchData = await searchRes.json();
  if (!searchData.records?.length) throw new Error(`Carrier "${carrierName}" not found`);

  const recordId = searchData.records[0].id;

  const updateRes = await fetch(`${AIRTABLE_API}/${BASE_ID}/${encodeURIComponent('Carriers')}/${recordId}`, {
    method: 'PATCH',
    headers: airtableHeaders,
    body: JSON.stringify({ fields }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(`Airtable update error: ${JSON.stringify(err)}`);
  }

  return { message: `Carrier "${carrierName}" updated successfully`, fields };
}

async function executeN8nWorkflow({ workflowName, payload }) {
  const webhookUrl = N8N_WEBHOOKS[workflowName];
  if (!webhookUrl) throw new Error(`Unknown workflow: ${workflowName}`);

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`n8n webhook failed: ${res.status}`);
  const data = await res.json().catch(() => ({ status: 'triggered' }));
  return { message: `Workflow "${workflowName}" executed successfully`, data };
}
