import { PLAN_DEFINITIONS, PLAN_ORDER } from '../lib/plans';

export default function PlanesPage() {
  return (
    <div style={{ padding: '48px var(--page-pad-x)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Planes</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Solo visible para staff de FRIA -- guía comercial interna, todavía no es pública.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', alignItems: 'start' }}>
        {PLAN_ORDER.map(key => {
          const p = PLAN_DEFINITIONS[key];
          return (
            <div key={key} style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
              border: p.featured ? '2px solid var(--accent-primary)' : '1px solid var(--border-card)',
              padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              {p.featured && (
                <span style={{
                  alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--info-bg)', color: 'var(--info-text)', fontSize: '10.5px',
                  fontWeight: 700, marginBottom: '8px',
                }}>
                  Más popular
                </span>
              )}
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>{p.segment}</div>

              <div style={{ fontFamily: 'var(--mono)', fontSize: '19px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '12px' }}>
                {p.priceLabel}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.priceAnnualLabel}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-card)' }}>
                {p.included.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>·</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-card)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>SLA</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}><strong>{p.sla.uptime}</strong> uptime</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>Respuesta {p.sla.response}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{p.sla.channels}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6,
        borderTop: '1px solid var(--border-card)', paddingTop: '18px',
      }}>
        Hoy en la aplicación real, el único acceso que se hace cumplir automáticamente es Inteligencia de Mercado
        (vía la pantalla de Tenants). Chat, el logo/Términos personalizados, y el límite de cotizaciones mensuales
        están disponibles/sin bloquear para cualquier tenant hoy, sin importar su plan -- esta tabla muestra el
        paquete comercial completo, no todo está restringido en el código todavía. El SLA es un compromiso
        comercial y de soporte humano, no algo que la aplicación pueda verificar por sí sola.
      </div>
    </div>
  );
}
