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

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function HomePage({ user }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ thisMonth: null, savings: null, avgTime: null, accuracy: null });
  const [monthly, setMonthly] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    async function load() {
      if (!user?.tenantUserId) { setLoading(false); return; }

      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const { data: quotesData } = await supabase
        .from('quotes')
        .select('id, origin_city, destination_city, created_at')
        .eq('requested_by', user.tenantUserId)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: false });

      const quotes = quotesData || [];
      const quoteIds = quotes.map(q => q.id);

      let rfqsByQuote = {};
      if (quoteIds.length) {
        const { data: rfqData } = await supabase
          .from('quote_rfqs')
          .select('quote_id, quoted_rate, status, responded_at')
          .in('quote_id', quoteIds);
        (rfqData || []).forEach(r => {
          if (!rfqsByQuote[r.quote_id]) rfqsByQuote[r.quote_id] = [];
          rfqsByQuote[r.quote_id].push(r);
        });
      }

      // Cotizaciones este mes (propias)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthQuotes = quotes.filter(q => new Date(q.created_at) >= startOfMonth);

      // Ahorro estimado -- spread entre la tarifa mas alta y la mas baja cotizada,
      // sumado en las cotizaciones de este mes con 2+ respuestas.
      let savings = 0;
      let hasSavingsData = false;
      thisMonthQuotes.forEach(q => {
        const rates = (rfqsByQuote[q.id] || [])
          .filter(r => r.status === 'responded' && r.quoted_rate)
          .map(r => Number(r.quoted_rate));
        if (rates.length >= 2) {
          savings += Math.max(...rates) - Math.min(...rates);
          hasSavingsData = true;
        }
      });

      // Tiempo promedio hasta la primera respuesta, cotizaciones de este mes
      let totalMinutes = 0, countWithResponse = 0;
      thisMonthQuotes.forEach(q => {
        const responded = (rfqsByQuote[q.id] || []).filter(r => r.status === 'responded' && r.responded_at);
        if (responded.length) {
          const first = responded.reduce((a, b) => new Date(a.responded_at) < new Date(b.responded_at) ? a : b);
          totalMinutes += (new Date(first.responded_at) - new Date(q.created_at)) / 60000;
          countWithResponse += 1;
        }
      });
      const avgTime = countWithResponse ? totalMinutes / countWithResponse : null;

      // Accuracy FRAI -- metrica global del modelo, no depende del tenant
      const { data: reliability } = await supabase
        .from('frai_reliability')
        .select('accuracy_rate_pct, calculated_at')
        .order('calculated_at', { ascending: false })
        .limit(1);
      const accuracy = reliability && reliability[0] ? Number(reliability[0].accuracy_rate_pct) : null;

      setStats({
        thisMonth: thisMonthQuotes.length,
        savings: hasSavingsData ? savings : null,
        avgTime,
        accuracy,
      });

      // Cotizaciones por mes -- ultimos 6 meses, propias
      const buckets = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()], value: 0 });
      }
      quotes.forEach(q => {
        const d = new Date(q.created_at);
        const bucket = buckets.find(b => b.year === d.getFullYear() && b.month === d.getMonth());
        if (bucket) bucket.value += 1;
      });
      setMonthly(buckets);

      // Actividad reciente -- ultimas cotizaciones propias
      setActivity(quotes.slice(0, 4).map(q => ({
        title: 'Cotización enviada',
        detail: `${q.origin_city} → ${q.destination_city} · ${timeAgo(q.created_at)}`,
      })));

      setLoading(false);
    }
    load();
  }, [user?.tenantUserId]);

  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = (user?.name || '').split(' ')[0] || '';
  const maxValue = Math.max(...monthly.map(m => m.value), 1);

  const STATS_DISPLAY = [
    { label: 'Cotizaciones este mes', value: stats.thisMonth ?? '—' },
    { label: 'Ahorro estimado', value: stats.savings != null ? `$${Math.round(stats.savings).toLocaleString()}` : '—' },
    { label: 'Tiempo promedio 1ª respuesta', value: stats.avgTime != null ? `${Math.round(stats.avgTime)} min` : '—' },
    { label: 'Accuracy FRAI', value: stats.accuracy != null ? `${stats.accuracy}%` : '—', success: true },
  ];

  return (
    <div style={{
      padding: `var(--content-padding-top) 56px var(--content-padding-bottom)`,
      display: 'flex', flexDirection: 'column', gap: '28px',
    }}>
      <div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Buenas tardes, {firstName}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'capitalize' }}>
          {today}
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--card-gap)' }}>
            {STATS_DISPLAY.map(s => (
              <Card key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  {s.label}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: 700,
                  color: s.success && s.value !== '—' ? 'var(--success-text)' : 'var(--text-primary)',
                }}>
                  {s.value}
                </div>
              </Card>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--card-gap)' }}>
            <Card style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Cotizaciones por mes</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '120px', padding: '0 4px' }}>
                {monthly.map(m => {
                  const isMax = m.value === maxValue && m.value > 0;
                  return (
                    <div key={`${m.year}-${m.month}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: '11px',
                        color: isMax ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}>
                        {m.value}
                      </div>
                      <div style={{
                        width: '100%', height: `${Math.max(2, (m.value / maxValue) * 100)}px`,
                        borderRadius: '5px 5px 0 0',
                        background: isMax ? 'var(--accent-logo)' : 'var(--accent-primary)',
                      }} />
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Actividad reciente</div>
              {activity.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Todavía no has enviado ninguna cotización.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {activity.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', marginTop: '6px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{a.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
