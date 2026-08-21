import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const BAR_COLORS = ['var(--accent-primary)', 'var(--accent-logo)'];

const STATUS_MAP = {
  pending: { label: 'Pendiente', bg: '#EEF1F8', color: 'var(--text-secondary)' },
  rfq_sent: { label: 'RFQs enviados', bg: '#E6EEFB', color: 'var(--accent-primary)' },
  responses_received: { label: 'Respuestas recibidas', bg: '#E6EEFB', color: 'var(--accent-primary)' },
  analysis_ready: { label: 'Análisis listo', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  sold: { label: 'Vendida', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  cancelled: { label: 'Cancelada', bg: 'var(--alert-bg)', color: 'var(--alert-text)' },
};

function formatWeekRange(start, end) {
  const lastDay = new Date(end);
  lastDay.setDate(lastDay.getDate() - 1); // 'end' es exclusivo, mostramos el último día real
  const startDay = start.getDate();
  const endDay = lastDay.getDate();
  const startMonthShort = start.toLocaleDateString('es-MX', { month: 'short' });
  const endMonthShort = lastDay.toLocaleDateString('es-MX', { month: 'short' });
  const monthLabel = lastDay.toLocaleDateString('es-MX', { month: 'long' });

  const rangeLabel = startMonthShort === endMonthShort
    ? `${startDay}–${endDay} ${startMonthShort}`
    : `${startDay} ${startMonthShort} – ${endDay} ${endMonthShort}`;

  return { rangeLabel, monthLabel };
}

function isoWeekStart(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // lunes = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

const TabBar = ({ tab, setTab }) => (
  <div style={{ display: 'flex', gap: '22px', padding: '20px var(--page-pad-x) 0' }}>
    {['Resumen de equipo', 'Panorama general'].map(t => (
      <div
        key={t}
        onClick={() => setTab(t)}
        style={{
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', paddingBottom: '10px',
          color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
          borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
        }}
      >
        {t}
      </div>
    ))}
  </div>
);

const StatCard = ({ label, value }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
    padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px',
  }}>
    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
      {label}
    </div>
    <div style={{ fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
      {value}
    </div>
  </div>
);

const BarList = ({ title, items, color }) => {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
      padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sin datos todavía.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {items.map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '5px' }}>
                <span>{item.label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{item.count}</span>
              </div>
              <div style={{ height: '10px', borderRadius: '5px', background: '#EEF1F8' }}>
                <div style={{ width: `${(item.count / max) * 100}%`, height: '100%', borderRadius: '5px', background: color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Select = ({ value, onChange, options, placeholder }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{
    height: '36px', padding: '0 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
    border: '1px solid var(--border-input)', fontSize: '12px', color: 'var(--text-tertiary)',
    fontFamily: 'var(--font)', outline: 'none',
  }}>
    <option value="">{placeholder}: Todos</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const PRow = ({ header, cols }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 1fr 1.1fr',
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

export default function MetricsPage() {
  const [tab, setTab] = useState('Resumen de equipo');
  const [quotes, setQuotes] = useState([]);
  const [sellersById, setSellersById] = useState({});
  const [rfqStats, setRfqStats] = useState({});
  const [loading, setLoading] = useState(true);

  const [filterSeller, setFilterSeller] = useState('');
  const [filterLane, setFilterLane] = useState('');
  const [panSeller, setPanSeller] = useState('');
  const [panLane, setPanLane] = useState('');

  useEffect(() => {
    async function load() {
      const { data: quotesData, error } = await supabase
        .from('quotes')
        .select('id, quote_number, origin_city, destination_city, status, requested_by, created_at')
        .order('created_at', { ascending: false });

      if (error || !quotesData) { setLoading(false); return; }

      const sellerIds = [...new Set(quotesData.map(q => q.requested_by).filter(Boolean))];
      let names = {};
      if (sellerIds.length) {
        const { data: sellers } = await supabase
          .from('tenant_users')
          .select('id, first_name')
          .in('id', sellerIds);
        (sellers || []).forEach(s => { names[s.id] = s.first_name; });
      }

      const quoteIds = quotesData.map(q => q.id);
      let rfqStatsByQuote = {};
      if (quoteIds.length) {
        const { data: rfqData } = await supabase
          .from('quote_rfqs')
          .select('quote_id, status, quoted_rate')
          .in('quote_id', quoteIds);

        (rfqData || []).forEach(r => {
          if (!rfqStatsByQuote[r.quote_id]) {
            rfqStatsByQuote[r.quote_id] = { contacted: 0, responded: 0, bestRate: null };
          }
          const stat = rfqStatsByQuote[r.quote_id];
          stat.contacted += 1;
          if (r.status === 'responded') {
            stat.responded += 1;
            if (r.quoted_rate && (!stat.bestRate || r.quoted_rate < stat.bestRate)) stat.bestRate = r.quoted_rate;
          }
        });
      }

      setQuotes(quotesData);
      setSellersById(names);
      setRfqStats(rfqStatsByQuote);
      setLoading(false);
    }
    load();
  }, []);

  const sellerOptions = useMemo(() => [...new Set(Object.values(sellersById))].sort(), [sellersById]);
  const laneOptions = useMemo(() => {
    const set = new Set(quotes.map(q => `${q.origin_city} → ${q.destination_city}`));
    return [...set].sort();
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      if (filterSeller && sellersById[q.requested_by] !== filterSeller) return false;
      if (filterLane && `${q.origin_city} → ${q.destination_city}` !== filterLane) return false;
      return true;
    });
  }, [quotes, filterSeller, filterLane, sellersById]);

  const bySeller = useMemo(() => {
    const counts = {};
    quotes.forEach(q => {
      const name = sellersById[q.requested_by] || 'Sin asignar';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [quotes, sellersById]);

  const byLane = useMemo(() => {
    const counts = {};
    quotes.forEach(q => {
      const label = `${q.origin_city} → ${q.destination_city}`;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [quotes]);

  const byWeek = useMemo(() => {
    const now = new Date();
    const buckets = [4, 3, 2, 1, 0].map(offset => {
      const start = new Date(isoWeekStart(now));
      start.setDate(start.getDate() - offset * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { offset, start, end, count: 0 };
    });
    filteredQuotes.forEach(q => {
      const created = new Date(q.created_at);
      const bucket = buckets.find(b => created >= b.start && created < b.end);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [filteredQuotes]);

  const maxWeek = Math.max(...byWeek.map(b => b.count), 1);

  const panoramaRows = useMemo(() => {
    return quotes
      .filter(q => {
        if (panSeller && sellersById[q.requested_by] !== panSeller) return false;
        if (panLane && `${q.origin_city} → ${q.destination_city}` !== panLane) return false;
        return true;
      })
      .map(q => ({ ...q, stats: rfqStats[q.id] || { contacted: 0, responded: 0, bestRate: null } }));
  }, [quotes, panSeller, panLane, sellersById, rfqStats]);

  return (
    <div>
      <TabBar tab={tab} setTab={setTab} />

      {tab === 'Panorama general' ? (
        loading ? (
          <div style={{ padding: '36px var(--page-pad-x)', fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
        ) : (
          <div style={{ padding: '36px var(--page-pad-x) 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Histórico y análisis de las cotizaciones de todo el equipo, no solo las propias.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Select value={panSeller} onChange={setPanSeller} options={sellerOptions} placeholder="Vendedor" />
              <Select value={panLane} onChange={setPanLane} options={laneOptions} placeholder="Ruta" />
            </div>

            {panoramaRows.length === 0 ? (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
                padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)',
              }}>
                Sin resultados para este filtro.
              </div>
            ) : (
              <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                <PRow header cols={['RFQ / Vendedor', 'Ruta', 'Carriers', 'Mejor tarifa', 'Estado']} />
                {panoramaRows.map(q => {
                  const st = STATUS_MAP[q.status] || STATUS_MAP.pending;
                  return (
                    <PRow key={q.id} cols={[
                      <div key="rv">
                        <div style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{q.quote_number}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sellersById[q.requested_by] || 'Sin asignar'}</div>
                      </div>,
                      <span key="lane">{q.origin_city} → {q.destination_city}</span>,
                      <span key="c" style={{ fontFamily: 'var(--mono)', color: 'var(--text-tertiary)' }}>
                        {q.stats.responded}/{q.stats.contacted}
                      </span>,
                      <span key="rate" style={{ fontFamily: 'var(--mono)', color: q.stats.bestRate ? 'var(--success-text)' : 'var(--text-secondary)' }}>
                        {q.stats.bestRate ? `$${q.stats.bestRate.toLocaleString()}` : '—'}
                      </span>,
                      <span key="s" style={{
                        padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                        background: st.bg, color: st.color,
                      }}>{st.label}</span>,
                    ]} />
                  );
                })}
                </div>
              </div>
            )}
          </div>
        )
      ) : loading ? (
        <div style={{ padding: '36px var(--page-pad-x)', fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
      ) : (
        <div style={{ padding: '36px var(--page-pad-x) 48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-3col)', gap: '20px' }}>
            <StatCard label="Cotizaciones totales" value={quotes.length} />
            <StatCard label="Vendedores activos" value={sellerOptions.length} />
            <StatCard label="Rutas únicas" value={laneOptions.length} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2col)', gap: '20px' }}>
            <BarList title="Cotizaciones por vendedor" items={bySeller} color={BAR_COLORS[0]} />
            <BarList title="Rutas más cotizadas" items={byLane} color={BAR_COLORS[1]} />
          </div>

          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Explorador de cotizaciones</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Select value={filterSeller} onChange={setFilterSeller} options={sellerOptions} placeholder="Vendedor" />
                <Select value={filterLane} onChange={setFilterLane} options={laneOptions} placeholder="Ruta" />
                <div title="Disponible próximamente" style={{
                  height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                  border: '1px solid var(--border-input)', display: 'flex', alignItems: 'center',
                  fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.6, cursor: 'not-allowed',
                }}>
                  Carrier: Todos ▾
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Cotizaciones por semana
            </div>
            <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '28px', height: '160px', padding: '0 8px', width: 'max-content' }}>
              {byWeek.map(b => {
                const { rangeLabel, monthLabel } = formatWeekRange(b.start, b.end);
                return (
                  <div key={b.offset} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: b.offset === 0 ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                      {b.count}
                    </div>
                    <div style={{
                      width: '40px', height: `${Math.max(6, (b.count / maxWeek) * 120)}px`, borderRadius: '6px 6px 0 0',
                      background: b.offset === 0 ? '#D7E0F2' : (b.count === maxWeek ? 'var(--accent-logo)' : 'var(--accent-primary)'),
                    }} />
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3 }}>
                      {rangeLabel}
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{monthLabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
