import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  SourcesBadge, MarketStatCard, RangePositionBar, OptionsVsMedianBars, Phase2Frame,
} from '../components/FraiWidgets';

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-lg)', padding: 'var(--card-padding)', ...style,
    }}>
      {children}
    </div>
  );
}

function equipLabel(e) {
  return (e || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function cityLabel(c) {
  return (c || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TRow = ({ header, cols, widths }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: widths || '1.5fr .8fr 1fr 1.25fr .7fr .7fr .9fr',
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

export default function MarketIntelligencePage({ user }) {
  const [loading, setLoading] = useState(true);
  const [miPlan, setMiPlan] = useState(null);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [reliability, setReliability] = useState(null);
  const [ownOptions, setOwnOptions] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants').select('mi_plan').maybeSingle();
      const plan = tenantError ? null : (tenantData?.mi_plan || 'none');
      setMiPlan(plan);
      if (!plan || plan === 'none') { setLoading(false); return; }

      const { data: fraiData } = await supabase
        .from('frai_index_values')
        .select('origin_city, destination_city, equipment_type, frai_value, projection_low, projection_high, sources, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      const latestByLane = {};
      (fraiData || []).forEach(r => {
        const key = `${r.origin_city}|${r.destination_city}|${r.equipment_type}`;
        if (!latestByLane[key]) latestByLane[key] = r;
      });
      const routes = Object.entries(latestByLane).map(([key, r]) => ({ key, ...r }))
        .sort((a, b) => (b.sources?.point_count || 0) - (a.sources?.point_count || 0));
      setAllRoutes(routes);
      if (routes.length) {
        setSelectedOrigin(routes[0].origin_city);
        setSelectedDestination(routes[0].destination_city);
        setSelectedEquipment(routes[0].equipment_type);
      }

      const { data: rel } = await supabase
        .from('frai_reliability')
        .select('accuracy_rate_pct, mape_pct, quote_count, calculated_date')
        .eq('is_publishable', true)
        .order('calculated_at', { ascending: false })
        .limit(1);
      setReliability(rel && rel[0] ? rel[0] : null);

      setLoading(false);
    }
    load();
  }, [user?.tenantUserId]);

  const selected = allRoutes.find(r =>
    r.origin_city === selectedOrigin && r.destination_city === selectedDestination && r.equipment_type === selectedEquipment
  );

  // Listas para cada uno de los 3 campos -- cada una se recorta segun lo que
  // ya se eligio antes (Destino solo muestra pares reales con el Origen
  // elegido; Equipo solo muestra los que existen para ese Origen+Destino).
  const uniqueOrigins = useMemo(() => {
    const set = new Set(allRoutes.map(r => r.origin_city));
    return [...set].sort((a, b) => cityLabel(a).localeCompare(cityLabel(b)));
  }, [allRoutes]);

  const destinationOptions = useMemo(() => {
    const set = new Set(allRoutes.filter(r => r.origin_city === selectedOrigin).map(r => r.destination_city));
    return [...set].sort((a, b) => cityLabel(a).localeCompare(cityLabel(b)));
  }, [allRoutes, selectedOrigin]);

  const equipmentOptions = useMemo(() => {
    const set = new Set(allRoutes.filter(r => r.origin_city === selectedOrigin && r.destination_city === selectedDestination).map(r => r.equipment_type));
    return [...set].sort((a, b) => equipLabel(a).localeCompare(equipLabel(b)));
  }, [allRoutes, selectedOrigin, selectedDestination]);

  // Al cambiar Origen, Destino y Equipo se reacomodan al primer valor real
  // disponible para la nueva combinacion -- para nunca dejar seleccionada
  // una pareja que no existe en los datos.
  function handleOriginChange(newOrigin) {
    setSelectedOrigin(newOrigin);
    const dests = [...new Set(allRoutes.filter(r => r.origin_city === newOrigin).map(r => r.destination_city))];
    const newDest = dests[0] || '';
    setSelectedDestination(newDest);
    const eqs = [...new Set(allRoutes.filter(r => r.origin_city === newOrigin && r.destination_city === newDest).map(r => r.equipment_type))];
    setSelectedEquipment(eqs[0] || '');
  }

  function handleDestinationChange(newDest) {
    setSelectedDestination(newDest);
    const eqs = [...new Set(allRoutes.filter(r => r.origin_city === selectedOrigin && r.destination_city === newDest).map(r => r.equipment_type))];
    setSelectedEquipment(eqs[0] || '');
  }

  useEffect(() => {
    async function loadOwn() {
      if (!selected) { setOwnOptions([]); return; }
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('id, origin_city, destination_city, equipment_type')
        .ilike('origin_city', `%${selected.origin_city}%`)
        .ilike('destination_city', `%${selected.destination_city}%`)
        .eq('equipment_type', selected.equipment_type)
        .limit(50);
      const quoteIds = (quotesData || []).map(q => q.id);
      if (!quoteIds.length) { setOwnOptions([]); return; }

      const { data: rfqData } = await supabase
        .from('quote_rfqs')
        .select('quote_id, quoted_rate, status, carrier_id, carriers(name)')
        .in('quote_id', quoteIds)
        .eq('status', 'responded')
        .not('quoted_rate', 'is', null)
        .order('responded_at', { ascending: false })
        .limit(20);

      const byCarrier = {};
      (rfqData || []).forEach(r => {
        const name = r.carriers?.name || 'Carrier';
        if (!byCarrier[name] || Number(r.quoted_rate) < byCarrier[name].price) {
          byCarrier[name] = { name, price: Number(r.quoted_rate) };
        }
      });
      setOwnOptions(Object.values(byCarrier));
    }
    loadOwn();
  }, [selectedOrigin, selectedDestination, selectedEquipment]);

  const bestOwnPrice = ownOptions.length ? Math.min(...ownOptions.map(o => o.price)) : null;
  const bestOwnCarrier = ownOptions.find(o => o.price === bestOwnPrice);
  const pctVsMedian = useMemo(() => {
    if (bestOwnPrice == null || !selected?.frai_value) return null;
    return ((bestOwnPrice / Number(selected.frai_value)) - 1) * 100;
  }, [bestOwnPrice, selected]);

  if (loading) {
    return <div style={{ padding: '48px var(--page-pad-x)', fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>;
  }

  if (!miPlan || miPlan === 'none') {
    return (
      <div style={{ padding: '48px var(--page-pad-x)', display: 'flex', justifyContent: 'center' }}>
        <Card style={{ maxWidth: '880px', width: '100%', padding: '48px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '26px' }}>
            {[0.4, 0.65, 1, 0.8, 0.55].map((h, i) => (
              <div key={i} style={{ width: '6px', height: `${h * 100}%`, borderRadius: '1px', background: 'var(--accent-primary)' }} />
            ))}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Inteligencia de Mercado es un plan superior
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.6 }}>
            Rango real de mercado por ruta y equipo, comparado contra tus propias cotizaciones — calculado con
            tarifarios y respuestas de carriers de toda la red de FRIA.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-3col)', gap: '14px', width: '100%', marginTop: '10px' }}>
            {[
              ['Mediana y rango real', 'Sabe si tu tarifa está dentro de mercado antes de cerrar.'],
              ['Comparativa por carrier', 'Tus propias cotizaciones contra la mediana, lado a lado.'],
              ['Tendencia semanal', 'Fase 2 — cómo se mueve el mercado con el tiempo.'],
            ].map(([t, d], i) => (
              <div key={i} style={{ textAlign: 'left', padding: '16px 18px', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{t}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>{d}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
            <button style={{
              height: '42px', padding: '0 22px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)',
              color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
            }}>
              Ver planes
            </button>
            <a href="mailto:adolfo.romero@friaai.com" style={{
              height: '42px', padding: '0 22px', borderRadius: 'var(--radius-md)', background: 'none',
              border: '1px solid var(--border-input)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
              display: 'flex', alignItems: 'center', textDecoration: 'none',
            }}>
              Hablar con ventas
            </a>
          </div>
        </Card>
      </div>
    );
  }

  if (allRoutes.length === 0) {
    return (
      <div style={{ padding: '48px var(--page-pad-x)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Inteligencia de Mercado</div>
        <Card style={{ textAlign: 'center', padding: '48px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Todavía no hay ninguna ruta con suficientes datos combinados (tarifarios + respuestas de carriers) para
          publicar un rango de mercado. Esto se actualiza cada semana.
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px var(--page-pad-x)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Inteligencia de Mercado</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Origen</div>
            <select value={selectedOrigin} onChange={e => handleOriginChange(e.target.value)} style={{
              height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
              border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px',
              color: 'var(--text-primary)', fontFamily: 'var(--font)', minWidth: '160px',
            }}>
              {uniqueOrigins.map(o => <option key={o} value={o}>{cityLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Destino</div>
            <select value={selectedDestination} onChange={e => handleDestinationChange(e.target.value)} style={{
              height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
              border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px',
              color: 'var(--text-primary)', fontFamily: 'var(--font)', minWidth: '160px',
            }}>
              {destinationOptions.map(d => <option key={d} value={d}>{cityLabel(d)}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Equipo</div>
            <select value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)} style={{
              height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
              border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px',
              color: 'var(--text-primary)', fontFamily: 'var(--font)', minWidth: '160px',
            }}>
              {equipmentOptions.map(eq => <option key={eq} value={eq}>{equipLabel(eq)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
        padding: '12px 18px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)', border: '1px solid var(--border-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <SourcesBadge pointCount={selected?.sources?.point_count} tenantCount={selected?.sources?.tenant_count} />
          {reliability ? (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              accuracy <strong style={{ color: 'var(--success-text)', fontFamily: 'var(--mono)' }}>{reliability.accuracy_rate_pct}%</strong>
              {' '}· MAPE <strong style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{reliability.mape_pct}%</strong>
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Accuracy: <strong>Aún no</strong> — no publicable todavía</span>
          )}
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Actualizado {fmtDate(selected?.created_at)} · corre cada lunes
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Nunca se muestra de qué empresa viene cada dato.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'var(--mi-hero-grid)', gap: '16px' }}>
        <MarketStatCard
          label="Mediana de mercado"
          value={selected ? `$${Number(selected.frai_value).toLocaleString()}` : '—'}
          tone="accent"
        />
        <MarketStatCard
          label="Rango observado"
          value={selected ? `$${Number(selected.projection_low).toLocaleString()} – $${Number(selected.projection_high).toLocaleString()}` : '—'}
          sub="P25–P75 es fase 2, hoy es mín–máx"
          size={22}
        />
        <MarketStatCard
          label="Tu mejor costo"
          value={bestOwnPrice != null ? `$${bestOwnPrice.toLocaleString()}` : 'Sin cotizaciones propias'}
          sub={bestOwnCarrier ? `${bestOwnCarrier.name}${pctVsMedian != null ? ` · ${pctVsMedian < 0 ? '−' : '+'}${Math.abs(pctVsMedian).toFixed(1)}% vs mediana` : ''}` : null}
          tone={bestOwnPrice != null ? 'success' : 'neutral'}
          size={bestOwnPrice != null ? 30 : 15}
        />
      </div>

      {selected && (
        <Card>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Posición dentro del rango</div>
          <RangePositionBar
            low={Number(selected.projection_low)}
            median={Number(selected.frai_value)}
            high={Number(selected.projection_high)}
            markers={ownOptions.map(o => ({ value: o.price, label: o.name, color: o.price === bestOwnPrice ? 'var(--success-text)' : 'var(--accent-primary)' }))}
          />
          {ownOptions.length > 0 && (
            <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Tus opciones vs mediana</div>
              <OptionsVsMedianBars options={ownOptions} median={Number(selected.frai_value)} />
            </div>
          )}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2col)', gap: '16px' }}>
        <Phase2Frame title="Tendencia semanal" reason="8 semanas de historial">
          <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Gráfica de mediana semanal — disponible cuando existan varias corridas.
          </div>
        </Phase2Frame>
        <Phase2Frame title="Dónde se concentra el mercado" reason="backend nuevo">
          <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Histograma de distribución — requiere guardar los datos individuales, no solo el resumen.
          </div>
        </Phase2Frame>
      </div>

      <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <TRow header cols={['Ruta', 'Equipo', 'Mediana', 'Rango', 'Datos', 'Fuentes', 'Tendencia']} />
        {allRoutes.map((r, i) => (
          <TRow key={i} cols={[
            <span key="lane" style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => { setSelectedOrigin(r.origin_city); setSelectedDestination(r.destination_city); setSelectedEquipment(r.equipment_type); }}>
              {cityLabel(r.origin_city)} → {cityLabel(r.destination_city)}
            </span>,
            <span key="eq" style={{ color: 'var(--text-secondary)' }}>{equipLabel(r.equipment_type)}</span>,
            <span key="mkt" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>
              ${Number(r.frai_value).toLocaleString()}
            </span>,
            <span key="range" style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              ${Number(r.projection_low).toLocaleString()}–${Number(r.projection_high).toLocaleString()}
            </span>,
            <span key="pts" style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{r.sources?.point_count ?? '—'}</span>,
            <span key="src" style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{r.sources?.tenant_count ?? '—'}</span>,
            <span key="trend" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>— fase 2</span>,
          ]} />
        ))}
        </div>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
        Calculado con tarifarios vigentes y respuestas reales de carriers de los últimos 6 meses, de toda la red de
        tenants de FRIA — nunca se muestra de qué empresa vino cada dato.
      </div>
    </div>
  );
}
