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

export default function HistoryPage({ user }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // quote seleccionada para el detalle

  useEffect(() => {
    async function load() {
      if (!user.tenantUserId) { setLoading(false); return; }

      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id, quote_number, origin_city, destination_city, status, created_at')
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
    return <DetalleRFQ quote={selected} onBack={() => setSelected(null)} />;
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
          <Row header cols={['RFQ ID', 'Ruta', 'Estado', 'Monto', 'Fecha', '']} />
          {filtered.map(q => {
            const st = STATUS_MAP[q.status] || STATUS_MAP.pending;
            return (
              <div key={q.id} onClick={() => setSelected(q)} style={{ cursor: 'pointer' }}>
                <Row cols={[
                  <span key="id" style={{ fontFamily: 'var(--mono)' }}>{q.quote_number}</span>,
                  <span key="lane">{q.origin_city} → {q.destination_city}</span>,
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

function Row({ header, cols }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '110px 1fr 150px 110px 100px 36px',
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
}

const RFQ_STATUS_MAP = {
  responded: { label: 'Cotizó', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  declined: { label: 'Rechazó', bg: 'var(--alert-bg)', color: 'var(--alert-text)' },
  no_response: { label: 'Sin responder', bg: '#EEF1F8', color: 'var(--text-secondary)' },
  sent: { label: 'Sin responder', bg: '#EEF1F8', color: 'var(--text-secondary)' },
};

function DetalleRFQ({ quote, onBack }) {
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('quote_rfqs')
        .select('status, quoted_rate, valid_until, carrier_notes, carriers(name)')
        .eq('quote_id', quote.id);
      if (!error && data) setCarriers(data);
      setLoading(false);
    }
    load();
  }, [quote.id]);

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
          {quote.quote_number} · {carriers.length} carriers contactados
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
          <DRow header cols={['Carrier', 'Estado', 'Tarifa', 'Detalle']} />
          {carriers.map((c, i) => {
            const st = RFQ_STATUS_MAP[c.status] || RFQ_STATUS_MAP.sent;
            let detail = '—';
            if (c.status === 'responded' && c.valid_until) detail = `Vigente hasta ${c.valid_until}`;
            else if (c.carrier_notes) detail = c.carrier_notes.split('\n')[0].slice(0, 80);
            return (
              <DRow key={i} cols={[
                <span key="name" style={{ fontWeight: 600 }}>{c.carriers?.name || 'Carrier'}</span>,
                <span key="st" style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                  background: st.bg, color: st.color,
                }}>{st.label}</span>,
                <span key="rate" style={{
                  fontFamily: 'var(--mono)',
                  color: c.quoted_rate ? 'var(--success-text)' : 'var(--text-secondary)',
                }}>
                  {c.quoted_rate ? `$${Number(c.quoted_rate).toLocaleString()}` : '—'}
                </span>,
                <span key="detail" style={{ color: 'var(--text-secondary)' }}>{detail}</span>,
              ]} />
            );
          })}
        </div>
      )}
    </div>
  );
}
