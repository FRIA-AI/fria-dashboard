// TEMPORAL — Chat todavía no tiene un backend de IA real conectado a los datos
// de FRIA (Sección 11.4 del business case, pendiente). Esta pantalla muestra el
// diseño real y una conversación de ejemplo para que se vea el flujo esperado,
// pero el campo de texto no envía nada todavía.

const EXAMPLE = [
  { from: 'user', text: '¿Por qué subió la tarifa de Monterrey a Laredo esta semana?' },
  {
    from: 'fria',
    html: 'Detecté una caída de capacidad del 18% en la ruta por alta demanda de dry van hacia EUA. El modelo tiene un <span style="font-family:var(--mono);color:var(--text-primary)">MAPE de 5.8%</span> y <span style="font-family:var(--mono);color:var(--success-text)">accuracy de 94.2%</span> en las últimas 30 cotizaciones, así que el ajuste está dentro del rango esperado.',
  },
  { from: 'user', text: 'Compárame ALCOSA vs Falcon Freight en esta ruta.' },
  {
    from: 'fria',
    compare: [
      { name: 'ALCOSA', detail: '$27,500 · 10 días · 14h tránsito' },
      { name: 'Falcon Freight', detail: '$28,900 · 7 días · 13h tránsito' },
    ],
  },
];

export default function ChatPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '18px 64px 0', maxWidth: '920px', margin: '0 auto', width: '100%',
      }}>
        <div style={{
          background: 'var(--info-bg)', border: '1px solid rgba(46,91,168,.3)', borderRadius: 'var(--radius-md)',
          padding: '10px 16px', fontSize: '12px', color: 'var(--info-text)',
        }}>
          Vista previa — Chat todavía no está conectado a tus datos reales. Así se va a ver.
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 64px', display: 'flex',
        flexDirection: 'column', gap: '18px', maxWidth: '920px', margin: '0 auto', width: '100%',
      }}>
        {EXAMPLE.map((m, i) => {
          if (m.from === 'user') {
            return (
              <div key={i} style={{
                alignSelf: 'flex-start', maxWidth: '70%', background: 'var(--bg-card)',
                border: '1px solid var(--border-card)', borderRadius: '12px', padding: '14px 18px',
                fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5,
              }}>
                {m.text}
              </div>
            );
          }
          return (
            <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textAlign: 'right', letterSpacing: '.04em' }}>
                FRIA
              </div>
              <div style={{
                background: 'var(--bg-panel)', border: '1px solid rgba(46,91,168,.25)', borderRadius: '12px',
                padding: '14px 18px', fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6,
              }}>
                {m.html && <div dangerouslySetInnerHTML={{ __html: m.html }} />}
                {m.compare && m.compare.map((c, j) => (
                  <div key={j} style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: j < m.compare.length - 1 ? '6px' : 0,
                  }}>
                    <span>{c.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{c.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '24px 64px 32px', display: 'flex', justifyContent: 'center' }}>
        <input
          disabled
          placeholder="Escribe tu pregunta a FRIA... (próximamente)"
          style={{
            height: '50px', width: '100%', maxWidth: '920px', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-card)', border: '1px solid var(--border-input)', padding: '0 18px',
            fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font)',
            cursor: 'not-allowed',
          }}
        />
      </div>
    </div>
  );
}
