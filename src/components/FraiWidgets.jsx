// pct < -0.5% -> verde (abajo del mercado), > +0.5% -> rojo (arriba),
// entre los dos -> "En mercado". Formato con signo menos real (−), 1 decimal.
export function VsMarketPill({ pct }) {
  if (pct == null) {
    return <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>—</span>;
  }
  const abs = Math.abs(pct).toFixed(1);
  let bg, color, label;
  if (pct < -0.5) {
    bg = 'var(--success-bg)'; color = 'var(--success-text)'; label = `−${abs}%`;
  } else if (pct > 0.5) {
    bg = 'var(--alert-bg)'; color = 'var(--alert-text)'; label = `+${abs}%`;
  } else {
    bg = '#EEF1F8'; color = 'var(--text-secondary)'; label = 'En mercado';
  }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: '20px', fontSize: '11px',
      fontWeight: 700, background: bg, color, fontFamily: 'var(--mono)', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// Copy fijo, nunca menciona "tenant" ni nombres de empresa -- solo conteos.
export function SourcesBadge({ pointCount, tenantCount }) {
  if (pointCount == null) return null;
  return (
    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
      <strong style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{pointCount}</strong> datos combinados
      {tenantCount != null && (
        <> · <strong style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{tenantCount}</strong> fuentes distintas</>
      )}
    </span>
  );
}

const TONE_COLORS = {
  neutral: 'var(--text-primary)',
  success: 'var(--success-text)',
  accent: 'var(--accent-primary)',
};

export function MarketStatCard({ label, value, sub, tone = 'neutral', size = 42, style }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '8px', ...style,
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: `${size}px`, fontWeight: 700, color: TONE_COLORS[tone] || TONE_COLORS.neutral }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

// Barra de posicion dentro del rango observado (low..high), con un tick en
// la mediana y un marcador circular por cada opcion (ej. cada carrier).
export function RangePositionBar({ low, median, high, markers = [] }) {
  const span = high - low || 1;
  const pct = v => Math.max(0, Math.min(100, ((v - low) / span) * 100));
  return (
    <div>
      <div style={{ position: 'relative', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, var(--success-text), #EEF1F8, var(--alert-text))' }}>
        <div style={{
          position: 'absolute', left: `${pct(median)}%`, top: '-4px', width: '2px', height: '16px',
          background: 'var(--text-primary)', transform: 'translateX(-50%)',
        }} />
        {markers.map((m, i) => (
          <div key={i} title={m.label} style={{
            position: 'absolute', left: `${pct(m.value)}%`, top: '-3px', width: '14px', height: '14px',
            borderRadius: '50%', background: m.color || 'var(--accent-primary)', border: '2px solid #FFFFFF',
            transform: 'translateX(-50%)', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
        <span>${Number(low).toLocaleString()}</span>
        <span>${Number(high).toLocaleString()}</span>
      </div>
    </div>
  );
}

// Barras horizontales de cada opcion (ej. carrier) vs la mediana de mercado.
// Ancho de barra = precio / max(precios) * 100. Verde la mas barata, rojo la
// que supera la mediana, gris intermedio para el resto.
export function OptionsVsMedianBars({ options = [], median }) {
  if (!options.length) return null;
  const maxPrice = Math.max(...options.map(o => o.price));
  const cheapest = Math.min(...options.map(o => o.price));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {options.map((o, i) => {
        const pct = (o.price / maxPrice) * 100;
        const isCheapest = o.price === cheapest;
        const aboveMedian = median && o.price > median;
        const color = isCheapest ? 'var(--success-text)' : aboveMedian ? 'var(--alert-text)' : 'var(--accent-primary)';
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600 }}>{o.name}</span>
              <span style={{ fontFamily: 'var(--mono)', color }}>${o.price.toLocaleString()}</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: '#F2F5FA' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Contenedor con borde punteado ambar para bloques de fase 2 (requieren
// semanas de historial o calculo nuevo de backend) -- nunca sale a
// produccion sin esta etiqueta mientras no haya datos reales detras.
export function Phase2Frame({ title, reason, children }) {
  return (
    <div style={{
      border: '1px dashed rgba(185,138,32,.65)', borderRadius: 'var(--radius-lg)',
      padding: '18px 20px', background: '#FDF6E7',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#5A4413' }}>{title}</div>
        <span style={{
          padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
          background: '#F5DFA6', color: '#5A4413',
        }}>
          FASE 2 · {reason}
        </span>
      </div>
      <div style={{ opacity: 0.45, pointerEvents: 'none' }}>{children}</div>
    </div>
  );
}

// Estado honesto cuando una ruta+equipo no llega al minimo de datos para
// publicar un rango -- nunca se muestra un numero poco confiable.
export function InsufficientDataState({ count, min = 5 }) {
  const pct = Math.min(100, (count / min) * 100);
  return (
    <div style={{ textAlign: 'center', padding: '20px 10px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        Todavía no hay suficientes datos para esta ruta y equipo.
      </div>
      <div style={{ maxWidth: '220px', margin: '0 auto' }}>
        <div style={{ height: '6px', borderRadius: '3px', background: '#EEF1F8' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: 'var(--accent-primary)' }} />
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          {count} / {min} datos
        </div>
      </div>
    </div>
  );
}
