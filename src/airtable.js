const AIRTABLE_TOKEN = 'pat47WzGdiLj2M7Bu.2d4eaeb508f4071039950f961c2620f0e7c4578ca5a53e6be32193fbd23c8f8e';
const BASE_ID = 'app8TKlzHRkSiHgnH';
const API = 'https://api.airtable.com/v0';

const headers = {
  'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

export async function getRecords(table, filterFormula = '', maxRecords = 100) {
  let url = `${API}/${BASE_ID}/${encodeURIComponent(table)}?maxRecords=${maxRecords}`;
  if (filterFormula) url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
  const data = await res.json();
  return data.records.map(r => ({ id: r.id, ...r.fields }));
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
    getRecords('Carriers', '', 200).catch(() => []),
    getRecords('Quotes', '', 200).catch(() => []),
    getRecords('Historical Rates', '', 200).catch(() => []),
  ]);
  return { carriers, quotes, historical };
}
