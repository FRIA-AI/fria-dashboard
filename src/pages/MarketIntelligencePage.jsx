import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

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

const TRow = ({ header, cols }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 0.8fr',
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

function equipLabel(e) {
  return (e || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function cityLabel(c) {
  return (c || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function MarketIntelligencePage({ user }) {
  const [loading, setLoading] = useState(true);
  const [miPlan, setMiPlan] = useState(null); // null = todavia cargando
  const [rows, setRows] = useState([]);
  const [accuracy, setAccuracy] = useState(null);

  useEffect(() => {
    async function load() {
      // RLS ya limita esta consulta al tenant del usuario -- no hace falta
      // pasar tenant_id explicito, igual que el resto del dashboard.
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('mi_plan')
        .maybeSingle();

      const plan = tenantError ? null : (tenantData?.mi_plan || 'none');
      setMiPlan(plan);

      if (!plan || plan === 'none') { setLoading(false); return; }

      // frai_index_values es global (no filtrado por tenant) -- se agrega
      // aqui a "la fila mas reciente por ruta+equipo", ya que cada corrida
      // semanal inserta una fila nueva sin sobreescribir la anterior.
      const { data: fraiData } = await supabase
        .from('frai_index_values')
        .select('origin_city, destination_city, equipment_type, frai_value, projection_low, projection_high, sources, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      const latestByLane = {};
      (fraiData || []).forEach(r => {
        const key = `${r.origin_city}|${r.destination_city}|${r.equipment_type}`;
        if (!latestByLane[key]) latestByLane[key] = r; // ya viene ordenado desc, la primera es la mas reciente
      });
      setRows(Object.values(latestByLane).sort((a, b) => (b.sources?.point_count || 0) - (a.sources?.point_count || 0)));

      const { data: reliability } = await supabase
        .from('frai_reliability')
        .select('accuracy_rate_pct, calculated_at')
        .eq('is_publishable', true)
        .order('calculated_at', { ascending: false })
        .limit(1);
      setAccuracy(reliability && reliability[0] ? Number(reliability[0].accuracy_rate_pct) : null);

      setLoading(false);
    }
    load();
  }, [user?.tenantUserId]);

  if (loading) {
    return <div style={{ padding: '48px 56px', fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>;
  }

  if (!miPlan || miPlan === 'none') {
    return (
      <div style={{ padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Inteligencia de Mercado</div>
        <Card style={{ textAlign: 'center', padding: '64px 40px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Disponible en un plan superior
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px' }}>
            Inteligencia de Mercado muestra el rango real de tarifas por ruta y equipo, calculado con datos
            de tarifarios y respuestas de carriers de toda la red de FRIA. Contacta a tu administrador de
            cuenta para activarlo.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Inteligencia de Mercado</div>

      {accuracy != null && (
        <Card style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '20px 24px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '30px', fontWeight: 700, color: 'var(--success-text)' }}>
            {accuracy}%
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            accuracy del índice FRAI, medido contra tarifas reales de carriers
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Todavía no hay suficientes datos para mostrar rangos por ruta. FRAI necesita al menos 5 tarifarios
          o respuestas de carriers combinadas por ruta y equipo antes de publicar un rango.
        </Card>
      ) : (
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
          <TRow header cols={['Ruta', 'Equipo', 'Tarifa de mercado', 'Mínimo', 'Máximo', 'Datos']} />
          {rows.map((r, i) => (
            <TRow key={i} cols={[
              <span key="lane" style={{ fontWeight: 600 }}>{cityLabel(r.origin_city)} → {cityLabel(r.destination_city)}</span>,
              <span key="eq" style={{ color: 'var(--text-tertiary)' }}>{equipLabel(r.equipment_type)}</span>,
              <span key="mkt" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>
                ${Number(r.frai_value).toLocaleString()}
              </span>,
              <span key="low" style={{ fontFamily: 'var(--mono)', color: 'var(--success-text)' }}>
                ${Number(r.projection_low).toLocaleString()}
              </span>,
              <span key="high" style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
                ${Number(r.projection_high).toLocaleString()}
              </span>,
              <span key="pts" style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {r.sources?.point_count ?? '—'}
              </span>,
            ]} />
          ))}
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
        Calculado con tarifarios vigentes y respuestas reales de carriers de los últimos 6 meses, de toda
        la red de tenants de FRIA — nunca se muestra de qué empresa vino cada dato.
      </div>
    </div>
  );
}
