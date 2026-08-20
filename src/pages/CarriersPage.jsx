import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CARRIER_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook/carrier-ingestion';

const GEO_LABELS = {
  domestic_mx: 'Doméstico MX',
  cross_border: 'Cross-border',
  domestic_usa: 'Doméstico USA',
};

function formatEquipment(arr) {
  if (!arr || !arr.length) return '—';
  return arr.map(e => e.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' / ');
}

function formatGeo(arr) {
  if (!arr || !arr.length) return '—';
  return arr.map(g => GEO_LABELS[g] || g).join(' / ');
}

const CRow = ({ header, cols }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '1.3fr 1.3fr 1.2fr 1.5fr',
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

export default function CarriersPage({ user }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [carriers, setCarriers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  async function loadCarriers() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from('carriers')
      .select('id, name, geographies, equipment_types, email')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (!error && data) setCarriers(data);
    setLoadingList(false);
  }

  useEffect(() => { loadCarriers(); }, []);

  function validateAndSetFile(f) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx') {
      setError('Solo se aceptan archivos Excel (.xlsx). Descarga la plantilla de arriba.');
      return;
    }
    setError('');
    setFile(f);
  }

  async function handleSubmit() {
    if (!file) return;
    setStatus('loading');
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('data', file);
      formData.append('uploaderEmail', user.email);

      const res = await fetch(CARRIER_WEBHOOK_URL, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setResult(data);
      setStatus('success');
      setFile(null);
      loadCarriers();
    } catch (e) {
      setError('No se pudo conectar con FRIA. Intenta de nuevo.');
      setStatus('error');
    }
  }

  return (
    <div style={{ padding: '48px var(--page-pad-x)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Carriers</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'var(--grid-2col)', gap: '20px' }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>FRIA Carrier Template</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Formato estándar para cargar carriers, servicio y contactos.
          </div>
          <a href="/carrier-template.xlsx" download style={{
            alignSelf: 'flex-start', height: '38px', padding: '0 18px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-input)', color: 'var(--text-primary)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600,
          }}>
            Descargar plantilla
          </a>
        </div>

        <div
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) validateAndSetFile(f); }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => document.getElementById('carrier-file-input').click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent-primary)' : 'rgba(46,91,168,.35)'}`,
            borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '24px',
            background: 'var(--bg-panel)', cursor: 'pointer',
          }}
        >
          {file ? (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{(file.size / 1024).toFixed(1)} KB</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={e => { e.stopPropagation(); handleSubmit(); }} disabled={status === 'loading'} style={{
                  height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)',
                  color: '#FFFFFF', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                }}>
                  {status === 'loading' ? 'Subiendo…' : 'Subir archivo'}
                </button>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{
                  height: '36px', padding: '0 12px', borderRadius: 'var(--radius-md)', background: 'none',
                  border: '1px solid var(--border-input)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)',
                }}>
                  Quitar
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Arrastra tu Excel de carriers aquí</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>.xlsx</div>
              <div style={{
                height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)',
                color: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 700,
              }}>
                Subir archivo
              </div>
            </>
          )}
          <input id="carrier-file-input" type="file" accept=".xlsx" onChange={e => { const f = e.target.files[0]; if (f) validateAndSetFile(f); }} style={{ display: 'none' }} />
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '13px', color: 'var(--alert-text)' }}>{error}</div>
      )}

      {status === 'success' && result && (
        <div style={{
          background: 'var(--success-bg)', border: '1px solid var(--success-text)', borderRadius: 'var(--radius-lg)',
          padding: '18px 22px', display: 'flex', gap: '32px', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '22px', fontWeight: 700, color: 'var(--success-text)' }}>{result.inserted}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>nuevos</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{result.updated}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>actualizados</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '22px', fontWeight: 700, color: result.errorCount > 0 ? 'var(--alert-text)' : 'var(--text-secondary)' }}>{result.errorCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>errores</div>
          </div>
        </div>
      )}

      {loadingList ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <CRow header cols={['Carrier', 'Servicio', 'Equipo', 'Correo']} />
          {carriers.map(c => (
            <CRow key={c.id} cols={[
              <span key="n" style={{ fontWeight: 600 }}>{c.name}</span>,
              <span key="g" style={{ color: 'var(--text-tertiary)' }}>{formatGeo(c.geographies)}</span>,
              <span key="e" style={{ color: 'var(--text-tertiary)' }}>{formatEquipment(c.equipment_types)}</span>,
              <span key="m" style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>{c.email || '—'}</span>,
            ]} />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
