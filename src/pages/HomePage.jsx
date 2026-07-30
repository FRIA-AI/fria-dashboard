const STATS = [
  { label: 'Cotizaciones este mes', value: '187' },
  { label: 'Ahorro estimado', value: '$41,200' },
  { label: 'Tiempo promedio', value: '4.4 min' },
  { label: 'Accuracy FRAI', value: '94.2%', success: true },
];

const MONTHLY = [
  { month: 'Feb', value: 28 },
  { month: 'Mar', value: 34 },
  { month: 'Abr', value: 25 },
  { month: 'May', value: 31 },
  { month: 'Jun', value: 40 },
  { month: 'Jul', value: 29 },
];

const ACTIVITY = [
  { title: 'Cotización enviada', detail: 'CDMX → Querétaro · hace 12 min', color: 'var(--accent-primary)' },
  { title: 'Cotización ganada — $2,610', detail: 'Chicago → CDMX · hoy', color: 'var(--success-text)' },
  { title: 'RFQ enviado a 9 carriers', detail: 'Monterrey → Laredo · hace 1 h', color: 'var(--accent-primary)' },
];

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

export default function HomePage({ user }) {
  const maxValue = Math.max(...MONTHLY.map(m => m.value));
  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = (user?.name || '').split(' ')[0] || '';

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--card-gap)' }}>
        {STATS.map(s => (
          <Card key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: 700,
              color: s.success ? 'var(--success-text)' : 'var(--text-primary)',
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
            {MONTHLY.map(m => {
              const isMax = m.value === maxValue;
              return (
                <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: '11px',
                    color: isMax ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}>
                    {m.value}
                  </div>
                  <div style={{
                    width: '100%', height: `${(m.value / maxValue) * 100}px`,
                    borderRadius: '5px 5px 0 0',
                    background: isMax ? 'var(--accent-logo)' : 'var(--accent-primary)',
                  }} />
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m.month}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Actividad reciente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.color, marginTop: '6px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
