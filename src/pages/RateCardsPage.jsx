import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const STATUS_MAP = {
  processed: { label: 'Procesado', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  error: { label: 'Revisar', bg: 'var(--alert-bg)', color: 'var(--alert-text)' },
  pending: { label: 'Pendiente', bg: '#EEF1F8', color: 'var(--text-secondary)' },
};

function timeAgo(iso) {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return `hace ${Math.round(days / 7)} semana${days >= 14 ? 's' : ''}`;
}

const TabBar = ({ tab, setTab }) => (
  <div style={{ display: 'flex', gap: '22px', padding: '20px 56px 0' }}>
    {['Tarifarios', 'Rutas'].map(t => (
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

export default function RateCardsPage() {
  const [tab, setTab] = useState('Tarifarios');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: rateCards, error } = await supabase
        .from('rate_cards')
        .select('carrier_id, ingestion_status, created_at');

      if (error || !rateCards) { setLoading(false); return; }

      const carrierIds = [...new Set(rateCards.map(r => r.carrier_id).filter(Boolean))];
      let namesById = {};
      if (carrierIds.length) {
        const { data: carriers } = await supabase
          .from('carriers')
          .select('id, name')
          .in('id', carrierIds);
        (carriers || []).forEach(c => { namesById[c.id] = c.name; });
      }

      const grouped = {};
      rateCards.forEach(r => {
        const key = r.carrier_id || 'sin_carrier';
        if (!grouped[key]) {
          grouped[key] = { carrier: namesById[r.carrier_id] || 'Sin carrier', total: 0, errors: 0, lastDate: null };
        }
        grouped[key].total += 1;
        if (r.ingestion_status === 'error') grouped[key].errors += 1;
        if (!grouped[key].lastDate || r.created_at > grouped[key].lastDate) grouped[key].lastDate = r.created_at;
      });

      setRows(Object.values(grouped));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <TabBar tab={tab} setTab={setTab} />

      {tab === 'Rutas' ? (
        <div style={{ padding: '36px 56px 48px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          En construcción — próxima pantalla en la lista.
        </div>
      ) : (
        <div style={{ padding: '36px 56px 48px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '20px' }}>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
              padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>FRIA Rate Card Template</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Formato estándar para cargar tarifas por ruta y equipo.
              </div>
              <button disabled title="Disponible próximamente" style={{
                alignSelf: 'flex-start', height: '38px', padding: '0 18px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-input)', background: 'none', color: 'var(--text-primary)',
                fontSize: '13px', fontWeight: 600, cursor: 'not-allowed', fontFamily: 'var(--font)', opacity: 0.6,
              }}>
                Descargar plantilla
              </button>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); }}
              title="Disponible próximamente — todavía no existe el flujo de ingesta"
              style={{
                border: `2px dashed ${dragging ? 'var(--accent-primary)' : 'rgba(46,91,168,.35)'}`,
                borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px',
                background: 'var(--bg-panel)', cursor: 'not-allowed',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Arrastra tu tarifario aquí</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>.xlsx · hasta 10MB · próximamente</div>
            </div>
          </div>

          {loading ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
          ) : rows.length === 0 ? (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
              padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)',
            }}>
              Todavía no hay tarifarios cargados.
            </div>
          ) : (
            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
              <TRow header cols={['Carrier', 'Rutas / errores', 'Estado', 'Cargado']} />
              {rows.map((r, i) => {
                const st = r.errors > 0 ? STATUS_MAP.error : STATUS_MAP.processed;
                return (
                  <TRow key={i} cols={[
                    <span key="c" style={{ fontWeight: 600 }}>{r.carrier}</span>,
                    <span key="n" style={{
                      fontFamily: 'var(--mono)',
                      color: r.errors > 0 ? 'var(--alert-text)' : 'var(--text-primary)',
                    }}>
                      {r.errors > 0 ? `${r.errors} errores` : `${r.total} rutas`}
                    </span>,
                    <span key="s" style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                      background: st.bg, color: st.color,
                    }}>{st.label}</span>,
                    <span key="d" style={{ color: 'var(--text-secondary)' }}>{timeAgo(r.lastDate)}</span>,
                  ]} />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TRow = ({ header, cols }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
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
