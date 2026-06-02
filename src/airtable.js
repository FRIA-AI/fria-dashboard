const AIRTABLE_TOKEN = 'pat47WzGdiLj2M7Bu.2d4eaeb508f4071039950f961c2620f0e7c4578ca5a53e6be32193fbd23c8f8e';
const BASE_ID = 'app8TKlzHRkSiHgnH';
const API = 'https://api.airtable.com/v0';

const headers = {
  'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

// Fetch ALL records using pagination (Airtable returns max 100 per page)
export async function getRecords(table, filterFormula = '') {
  let allRecords = [];
  let offset = null;

  do {
    let url = `${API}/${BASE_ID}/${encodeURIComponent(table)}?pageSize=100`;
    if (filterFormula) url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
    const data = await res.json();

    const records = data.records.map(r => ({ id: r.id, ...r.fields }));
    allRecords = [...allRecords, ...records];
    offset = data.offset || null;
  } while (offset);

  return allRecords;
}

export async function updateRecord(table, recordId, fields) {
  const res = await fetch(`${API}/${BASE_ID}/${encodeURIComponent(table)}/${recordId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
  return res.json();
}

export async function createRecord(table, fields) {
  const res = await fetch(`${API}/${BASE_ID}/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
  return res.json();
}

// Fetch all key data for NORA context
export async function getNORAContext() {
  const [carriers, quotes, historical] = await Promise.all([
    getRecords('Carriers').catch(() => []),
    getRecords('Quotes').catch(() => []),
    getRecords('Historical Rates').catch(() => []),
  ]);
  return { carriers, quotes, historical };
}
