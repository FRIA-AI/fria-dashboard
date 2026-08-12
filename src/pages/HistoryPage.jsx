import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const STATUS_MAP = {
  pending: { label: 'Pendiente', bg: '#EEF1F8', color: 'var(--text-secondary)' },
  rfq_sent: { label: 'RFQs enviados', bg: '#E6EEFB', color: 'var(--accent-primary)' },
  responses_received: { label: 'Respuestas recibidas', bg: '#E6EEFB', color: 'var(--accent-primary)' },
  analysis_ready: { label: 'Análisis listo', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  sold: { label: 'Vendida', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  cancelled: { label: 'Cancelada', bg: 'var(--alert-bg)', color: 'var(--alert-text)' },
};

const RFQ_STATUS_MAP = {
  responded: { label: 'Cotizó', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  declined: { label: 'Rechazó', bg: 'var(--alert-bg)', color: 'var(--alert-text)' },
  no_response: { label: 'Sin responder', bg: '#EEF1F8', color: 'var(--text-secondary)' },
  sent: { label: 'Sin responder', bg: '#EEF1F8', color: 'var(--text-secondary)' },
};

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'justo ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

// Definidas ANTES de usarse, como const -- no dependemos de hoisting de function declarations.
const HistorialRow = ({ header, cols }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: 'minmax(200px, 1.2fr) minmax(220px, 2fr) minmax(90px, 1fr) minmax(130px, 1fr) minmax(90px, 0.8fr) minmax(80px, 0.8fr) 24px',
    padding: header ? '12px 22px' : '16px 22px',
    background: '#FFFFFF',
    borderTop: header ? 'none' : '1px solid var(--border-card)',
    fontSize: header ? '11px' : '13px',
    fontWeight: header ? 600 : 400,
    color: header ? 'var(--text-secondary)' : 'var(--text-primary)',
    textTransform: header ? 'uppercase' : 'none',
    letterSpacing: header ? '.04em' : 'normal',
    alignItems: 'center',
  }}>
    {cols.map((c, i) => <div key={i}>{c}</div>)}
  </div>
);

const DetalleRow = ({ header, cols }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: 'minmax(140px, 1.3fr) minmax(120px, 1fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(110px, 1fr) minmax(90px, 0.8fr)',
    padding: header ? '12px 22px' : '14px 22px',
    background: '#FFFFFF',
    borderTop: header ? 'none' : '1px solid var(--border-card)',
    fontSize: header ? '11px' : '13px',
    fontWeight: header ? 600 : 400,
    color: header ? 'var(--text-secondary)' : 'var(--text-primary)',
    textTransform: header ? 'uppercase' : 'none',
    letterSpacing: header ? '.04em' : 'normal',
    alignItems: 'center',
  }}>
    {cols.map((c, i) => <div key={i}>{c}</div>)}
  </div>
);

// Misma logica de referencia que RFQPage.jsx (tarifarios + cotizaciones
// vendidas anteriores, match bidireccional en pares, tarifario > cotizacion
// anterior por carrier) -- aqui se combina ademas con los RFQs reales que
// SI se mandaron para esta cotizacion especifica.
async function fetchReferenceByCarrier(quoteId, originCity, destinationCity, equipmentType) {
  const today = new Date().toISOString().slice(0, 10);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: rateCardsData } = await supabase
    .from('rate_cards')
    .select('carrier_id, base_rate, valid_until')
    .eq('equipment_type', equipmentType)
    .eq('is_active', true)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .or(`and(origin_city.ilike.%${originCity}%,destination_city.ilike.%${destinationCity}%),and(origin_city.ilike.%${destinationCity}%,destination_city.ilike.%${originCity}%)`)
    .limit(50);

  const { data: historicalQuotes } = await supabase
    .from('quotes')
    .select('sell_price, created_at, selected_rfq_id')
    .neq('id', quoteId)
    .eq('equipment_type', equipmentType)
    .ilike('origin_city', `%${originCity}%`)
    .ilike('destination_city', `%${destinationCity}%`)
    .gte('created_at', twelveMonthsAgo.toISOString())
    .not('sell_price', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  const rfqIds = (historicalQuotes || []).map(q => q.selected_rfq_id).filter(Boolean);
  let carrierByRfqId = {};
  if (rfqIds.length) {
    const { data: winningRfqs } = await supabase.from('quote_rfqs').select('id, carrier_id').in('id', rfqIds);
    (winningRfqs || []).forEach(r => { carrierByRfqId[r.id] = r.carrier_id; });
  }

  const bestRateCardByCarrier = {};
  (rateCardsData || []).forEach(r => {
    const current = bestRateCardByCarrier[r.carrier_id];
    if (!current || Number(r.base_rate) < Number(current.base_rate)) bestRateCardByCarrier[r.carrier_id] = r;
  });

  const bestHistoricalByCarrier = {};
  (historicalQuotes || []).forEach(q => {
    const carrierId = carrierByRfqId[q.selected_rfq_id];
    if (!carrierId) return;
    const current = bestHistoricalByCarrier[carrierId];
    if (!current || new Date(q.created_at) > new Date(current.created_at)) bestHistoricalByCarrier[carrierId] = { ...q, carrier_id: carrierId };
  });

  const byCarrier = {};
  Object.keys(bestRateCardByCarrier).forEach(carrierId => {
    const rc = bestRateCardByCarrier[carrierId];
    byCarrier[carrierId] = {
      source: 'tarifario', price: Number(rc.base_rate),
      detail: rc.valid_until ? `Vigente hasta ${rc.valid_until}` : 'Tarifario de referencia',
    };
  });
  Object.keys(bestHistoricalByCarrier).forEach(carrierId => {
    if (byCarrier[carrierId]) return; // el tarifario ya manda si existe
    const h = bestHistoricalByCarrier[carrierId];
    byCarrier[carrierId] = { source: 'cotizacion_anterior', price: Number(h.sell_price), detail: `Cotización de hace ${timeAgo(h.created_at)}` };
  });

  return byCarrier;
}

const ORIGIN_BADGE = {
  tarifario: { label: 'Tarifario', bg: '#EEF1F8', color: 'var(--text-secondary)' },
  cotizacion_anterior: { label: 'Cotización anterior', bg: 'var(--info-bg)', color: 'var(--info-text)' },
};

const DetalleRFQ = ({ quote, onBack, onSellQuote }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: liveRfqs, error } = await supabase
        .from('quote_rfqs')
        .select('carrier_id, status, quoted_rate, valid_until, transit_days, carrier_notes, carriers(name)')
        .eq('quote_id', quote.id);
      if (error) { setLoading(false); return; }

      const referenceByCarrier = await fetchReferenceByCarrier(
        quote.id, quote.origin_city, quote.destination_city, quote.equipment_type
      );

      // Nombres de carriers que solo vienen de la referencia (no tienen RFQ en vivo)
      const liveCarrierIds = new Set((liveRfqs || []).map(r => r.carrier_id));
      const onlyReferenceIds = Object.keys(referenceByCarrier).filter(id => !liveCarrierIds.has(id));
      let referenceNames = {};
      if (onlyReferenceIds.length) {
        const { data: carriersData } = await supabase.from('carriers').select('id, name').in('id', onlyReferenceIds);
        (carriersData || []).forEach(c => { referenceNames[c.id] = c.name; });
      }

      const liveRows = (liveRfqs || []).map(r => ({
        carrierId: r.carrier_id,
        name: r.carriers?.name || 'Carrier',
        reference: referenceByCarrier[r.carrier_id] || null,
        live: r,
      }));
      const referenceOnlyRows = onlyReferenceIds.map(id => ({
        carrierId: id,
        name: referenceNames[id] || 'Carrier',
        reference: referenceByCarrier[id],
        live: null,
      }));

      setRows([...liveRows, ...referenceOnlyRows]);
      setLoading(false);
    }
    load();
  }, [quote.id, quote.origin_city, quote.destination_city, quote.equipment_type]);

  return (
    <div style={{ padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div onClick={onBack} style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        ← Historial
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {quote.origin_city} → {quote.destination_city}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {quote.quote_number} · {rows.length} carriers considerados
        </div>
      </div>

      {quote.sell_price != null && (
        <div style={{
          background: 'var(--success-bg)', border: '1px solid var(--success-text)', borderRadius: 'var(--radius-lg)',
          padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success-text)' }}>
              Venta registrada · ${Number(quote.sell_price).toLocaleString()} MXN
            </div>
            {quote.sell_pdf_generated_at && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Generada el {new Date(quote.sell_pdf_generated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
          {quote.sell_pdf_url ? (
            <a href={quote.sell_pdf_url} target="_blank" rel="noopener noreferrer" style={{
              height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary)', color: '#FFFFFF', textDecoration: 'none',
              fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font)',
              display: 'flex', alignItems: 'center',
            }}>
              Descargar PDF
            </a>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PDF no disponible</span>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
          <DetalleRow header cols={['Carrier', 'Origen', 'Tarifa referencia', 'RFQ', 'Tarifa cotizada', '']} />
          {rows.map((r, i) => {
            const originBadge = r.reference ? ORIGIN_BADGE[r.reference.source] : null;
            const liveStatus = r.live ? (RFQ_STATUS_MAP[r.live.status] || RFQ_STATUS_MAP.sent) : null;
            const bestPrice = r.live?.status === 'responded' && r.live.quoted_rate ? Number(r.live.quoted_rate) : r.reference?.price ?? null;
            const bestCarrierName = r.name;
            return (
              <DetalleRow key={i} cols={[
                <span key="name" style={{ fontWeight: 600 }}>{r.name}</span>,
                <span key="origin">
                  {originBadge ? (
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                      background: originBadge.bg, color: originBadge.color,
                    }}>{originBadge.label}</span>
                  ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </span>,
                <span key="refprice" style={{ fontFamily: 'var(--mono)', color: r.reference ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {r.reference ? `$${r.reference.price.toLocaleString()}` : '—'}
                </span>,
                <span key="live">
                  {liveStatus ? (
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                      background: liveStatus.bg, color: liveStatus.color,
                    }}>{liveStatus.label}</span>
                  ) : <span style={{ color: 'var(--text-secondary)' }}>No se envió</span>}
                </span>,
                <span key="liverate" style={{
                  fontFamily: 'var(--mono)',
                  color: r.live?.quoted_rate ? 'var(--success-text)' : 'var(--text-secondary)',
                }}>
                  {r.live?.quoted_rate ? `$${Number(r.live.quoted_rate).toLocaleString()}` : '—'}
                </span>,
                <span key="action">
                  {bestPrice != null && onSellQuote && (
                    <button onClick={() => onSellQuote({
                      quoteNumber: quote.quote_number,
                      origin: quote.origin_city,
                      destination: quote.destination_city,
                      equipment: quote.equipment_type,
                      carrierName: bestCarrierName,
                      baseRate: bestPrice,
                      currency: 'MXN',
                      validUntil: r.live?.valid_until || null,
                      transitDays: r.live?.transit_days || null,
                      quoteId: quote.id,
                      returnTo: 'history',
                    })} style={{
                      height: '30px', padding: '0 12px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-primary)', color: '#FFFFFF', border: 'none',
                      fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                    }}>
                      Armar venta
                    </button>
                  )}
                </span>,
              ]} />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function HistoryPage({ user, onSellQuote }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      if (!user.tenantUserId) { setLoading(false); return; }

      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id, quote_number, origin_city, destination_city, equipment_type, status, created_at, sell_price, sell_pdf_url, sell_pdf_generated_at')
        .eq('requested_by', user.tenantUserId)
        .order('created_at', { ascending: false });

      if (quotesError || !quotesData) { setLoading(false); return; }

      const quoteIds = quotesData.map(q => q.id);
      let ratesByQuote = {};

      if (quoteIds.length) {
        const { data: rfqData } = await supabase
          .from('quote_rfqs')
          .select('quote_id, quoted_rate, status')
          .in('quote_id', quoteIds)
          .eq('status', 'responded');

        (rfqData || []).forEach(r => {
          if (!r.quoted_rate) return;
          if (!ratesByQuote[r.quote_id] || r.quoted_rate < ratesByQuote[r.quote_id]) {
            ratesByQuote[r.quote_id] = r.quoted_rate;
          }
        });
      }

      setRows(quotesData.map(q => ({ ...q, bestRate: ratesByQuote[q.id] || null })));
      setLoading(false);
    }
    load();
  }, [user.tenantUserId]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.quote_number?.toLowerCase().includes(s)
      || r.origin_city?.toLowerCase().includes(s)
      || r.destination_city?.toLowerCase().includes(s);
  });

  if (selected) {
    return <DetalleRFQ quote={selected} onBack={() => setSelected(null)} onSellQuote={onSellQuote} />;
  }

  return (
    <div style={{ padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
        Historial de cotizaciones
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Buscar por ruta, mensaje o RFQ ID..."
        style={{
          height: '44px', maxWidth: '420px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)', border: '1px solid var(--border-input)',
          padding: '0 16px', fontSize: '13px', color: 'var(--text-primary)',
          outline: 'none', fontFamily: 'var(--font)',
        }}
      />

      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          {search ? 'Sin resultados para esa búsqueda.' : 'Todavía no has enviado ninguna cotización.'}
        </div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
          <HistorialRow header cols={['RFQ ID', 'Ruta', 'Equipo', 'Estado', 'Monto', 'Fecha', '']} />
          {filtered.map(q => {
            const st = STATUS_MAP[q.status] || STATUS_MAP.pending;
            const equipmentLabel = (q.equipment_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div key={q.id} onClick={() => setSelected(q)} style={{ cursor: 'pointer' }}>
                <HistorialRow cols={[
                  <span key="id" style={{ fontFamily: 'var(--mono)' }}>{q.quote_number}</span>,
                  <span key="lane">{q.origin_city} → {q.destination_city}</span>,
                  <span key="equip" style={{ color: 'var(--text-secondary)' }}>{equipmentLabel || '—'}</span>,
                  <span key="status" style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                    background: st.bg, color: st.color,
                  }}>{st.label}</span>,
                  <span key="rate" style={{ fontFamily: 'var(--mono)', color: q.bestRate ? 'var(--success-text)' : 'var(--text-secondary)' }}>
                    {q.bestRate ? `$${q.bestRate.toLocaleString()}` : '—'}
                  </span>,
                  <span key="date" style={{ color: 'var(--text-secondary)' }}>{timeAgo(q.created_at)}</span>,
                  <span key="chev" style={{ color: 'var(--accent-primary)' }}>›</span>,
                ]} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
