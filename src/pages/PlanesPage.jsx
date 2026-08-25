import { PLAN_DEFINITIONS, PLAN_ORDER } from '../lib/plans';

function Check({ on }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
      background: on ? 'var(--success-bg)' : 'transparent',
      color: on ? 'var(--success-text)' : 'var(--text-secondary)',
      fontSize: '11px', fontWeight: 700,
    }}>
      {on ? '✓' : '—'}
    </span>
  );
}

export default function PlanesPage() {
  return (
    <div style={{ padding: '48px var(--page-pad-x)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Planes</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Solo visible para staff de FRIA -- referencia comercial interna, todavía no es pública.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
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
              <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {p.priceLabel}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                  {p.userLimit ? `Hasta ${p.userLimit} usuarios` : 'Usuarios ilimitados'}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>{p.quoteLimitLabel}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check on={p.marketIntelligence} />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Inteligencia de Mercado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check on={p.featureChat} />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Chat con FRIA</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check on={p.featureBranding} />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>Logo y T&C propios en PDFs</span>
                </div>
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
        (vía la pantalla de Tenants). Chat y el logo/Términos personalizados están disponibles para cualquier
        tenant sin importar su plan -- esta tabla muestra el paquete comercial completo, no todo está restringido
        en el código todavía.
      </div>
    </div>
  );
}
