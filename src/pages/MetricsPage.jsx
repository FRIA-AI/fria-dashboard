import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const BAR_COLORS = ['var(--accent-primary)', 'var(--accent-logo)'];

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
  <div style={{ display: 'flex', gap: '22px', padding: '20px 56px 0' }}>
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

export default function MetricsPage() {
  const [tab, setTab] = useState('Resumen de equipo');
  const [quotes, setQuotes] = useState([]);
  const [sellersById, setSellersById] = useState({});
  const [loading, setLoading] = useState(true);

  const [filterSeller, setFilterSeller] = useState('');
  const [filterLane, setFilterLane] = useState('');

  useEffect(() => {
    async function load() {
      const { data: quotesData, error } = await supabase
        .from('quotes')
        .select('id, origin_city, destination_city, requested_by, created_at');

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

      setQuotes(quotesData);
      setSellersById(names);
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

  return (
    <div>
      <TabBar tab={tab} setTab={setTab} />

      {tab === 'Panorama general' ? (
        <div style={{ padding: '36px 56px 48px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          En construcción — próxima pantalla en la lista.
        </div>
      ) : loading ? (
        <div style={{ padding: '36px 56px', fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
      ) : (
        <div style={{ padding: '36px 56px 48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <StatCard label="Cotizaciones totales" value={quotes.length} />
            <StatCard label="Vendedores activos" value={sellerOptions.length} />
            <StatCard label="Rutas únicas" value={laneOptions.length} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '28px', height: '160px', padding: '0 8px' }}>
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
      )}
    </div>
  );
}
