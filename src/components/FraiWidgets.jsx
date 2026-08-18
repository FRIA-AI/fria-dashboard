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
