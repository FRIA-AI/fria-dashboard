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

const TARIFARIO_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook-test/fria-tarifarios';

export default function RateCardsPage({ user }) {
  const [tab, setTab] = useState('Tarifarios');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);

  const [carriers, setCarriers] = useState([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [geography, setGeography] = useState('');
  const selectedCarrier = carriers.find(c => c.id === selectedCarrierId);
  const carrierGeographies = selectedCarrier?.geographies || [];

  // Al cambiar de carrier, la geografia se deriva de lo que ese carrier
  // cubre realmente -- si solo maneja una, se autoselecciona; si maneja
  // varias, se limpia para que el usuario elija entre esas (nada mas).
  useEffect(() => {
    if (carrierGeographies.length === 1) setGeography(carrierGeographies[0]);
    else setGeography('');
  }, [selectedCarrierId]);

  const GEOGRAPHY_LABELS = {
    domestic_mx: 'Doméstico México',
    cross_border: 'Cross Border',
    domestic_usa: 'Doméstico USA',
  };

  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | loading | success | error
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const [lanes, setLanes] = useState([]);
  const [loadingLanes, setLoadingLanes] = useState(true);

  async function loadRateCards() {
    setLoading(true);
    const { data: rateCards, error } = await supabase
      .from('rate_cards')
      .select('carrier_id, ingestion_status, created_at');

    if (error || !rateCards) { setLoading(false); return; }

    const carrierIds = [...new Set(rateCards.map(r => r.carrier_id).filter(Boolean))];
    let namesById = {};
    if (carrierIds.length) {
      const { data: carriersData } = await supabase
        .from('carriers')
        .select('id, name')
        .in('id', carrierIds);
      (carriersData || []).forEach(c => { namesById[c.id] = c.name; });
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

  useEffect(() => { loadRateCards(); }, []);

  // Carriers activos para el selector de "a quien pertenece este tarifario",
  // incluyendo su(s) geografia(s) real(es) -- la geografia de la carga se
  // deriva de esto, no de una lista generica desconectada del carrier.
  useEffect(() => {
    async function loadCarriers() {
      const { data } = await supabase
        .from('carriers')
        .select('id, name, geographies')
        .eq('is_active', true)
        .order('name', { ascending: true });
      setCarriers(data || []);
    }
    loadCarriers();
  }, []);

  function validateAndSetFile(f) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx') {
      setUploadError('Solo se aceptan archivos Excel (.xlsx). Descarga la plantilla de arriba.');
      return;
    }
    setUploadError('');
    setFile(f);
  }

  async function handleUploadSubmit() {
    if (!file || !selectedCarrierId || !geography) return;
    setUploadStatus('loading');
    setUploadError('');
    setUploadResult(null);

    try {
      const carrier = carriers.find(c => c.id === selectedCarrierId);
      const formData = new FormData();
      formData.append('data', file);
      formData.append('carrierId', selectedCarrierId);
      formData.append('carrierName', carrier?.name || '');
      formData.append('uploadedByEmail', user?.email || '');
      formData.append('uploaderId', user?.id || '');
      formData.append('uploadedAt', new Date().toISOString());
      formData.append('geography', geography);
      formData.append('originalFileName', file.name);

      const res = await fetch(TARIFARIO_WEBHOOK_URL, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setUploadResult(data);
      setUploadStatus('success');
      setFile(null);
      setSelectedCarrierId('');
      loadRateCards();
    } catch (e) {
      setUploadError('No se pudo conectar con FRIA. Intenta de nuevo.');
      setUploadStatus('error');
    }
  }

  useEffect(() => {
    async function loadLanes() {
      const { data: quotesData, error } = await supabase
        .from('quotes')
        .select('id, origin_city, destination_city, equipment_type');
      if (error || !quotesData) { setLoadingLanes(false); return; }

      const quoteIds = quotesData.map(q => q.id);
      let ratesByQuote = {};
      if (quoteIds.length) {
        const { data: rfqData } = await supabase
          .from('quote_rfqs')
          .select('quote_id, quoted_rate, status')
          .in('quote_id', quoteIds)
          .eq('status', 'responded');
        (rfqData || []).forEach(r => {
          if (!r.quoted_rate) return;
          if (!ratesByQuote[r.quote_id]) ratesByQuote[r.quote_id] = [];
          ratesByQuote[r.quote_id].push(r.quoted_rate);
        });
      }

      const grouped = {};
      quotesData.forEach(q => {
        const key = `${q.origin_city}|${q.destination_city}|${q.equipment_type}`;
        if (!grouped[key]) {
          grouped[key] = {
            lane: `${q.origin_city} → ${q.destination_city}`,
            equipment: (q.equipment_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            count: 0, rates: [],
          };
        }
        grouped[key].count += 1;
        grouped[key].rates.push(...(ratesByQuote[q.id] || []));
      });

      setLanes(Object.values(grouped).sort((a, b) => b.count - a.count));
      setLoadingLanes(false);
    }
    loadLanes();
  }, []);

  return (
    <div>
      <TabBar tab={tab} setTab={setTab} />

      {tab === 'Rutas' ? (
        loadingLanes ? (
          <div style={{ padding: '36px 56px', fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
        ) : (
          <div style={{ padding: '36px 56px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-card)',
              border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '14px 18px',
            }}>
              Vista interna con lo observado por FRIA. Los benchmarks de mercado completos están en{' '}
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Market Intelligence</span> (próximamente).
            </div>

            {lanes.length === 0 ? (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
                padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)',
              }}>
                Todavía no hay cotizaciones registradas.
              </div>
            ) : (
              <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', overflow: 'hidden' }}>
                <TRow header cols={['Ruta', 'Equipo', '# Cotizaciones', 'Tarifa mín–máx observada']} widths="1.6fr 1fr 1fr 1.4fr" />
                {lanes.map((l, i) => (
                  <TRow key={i} widths="1.6fr 1fr 1fr 1.4fr" cols={[
                    <span key="l" style={{ fontWeight: 600 }}>{l.lane}</span>,
                    <span key="e" style={{ color: 'var(--text-tertiary)' }}>{l.equipment || '—'}</span>,
                    <span key="c" style={{ fontFamily: 'var(--mono)' }}>{l.count}</span>,
                    <span key="r" style={{ fontFamily: 'var(--mono)' }}>
                      {l.rates.length ? `$${Math.min(...l.rates).toLocaleString()} – $${Math.max(...l.rates).toLocaleString()}` : '—'}
                    </span>,
                  ]} />
                ))}
              </div>
            )}
          </div>
        )
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
              <a href="/FRIA_Plantilla_Tarifario.xlsx" download style={{
                alignSelf: 'flex-start', height: '38px', padding: '0 18px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-input)', background: 'none', color: 'var(--text-primary)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
                display: 'flex', alignItems: 'center', textDecoration: 'none',
              }}>
                Descargar plantilla
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select value={selectedCarrierId} onChange={e => setSelectedCarrierId(e.target.value)} style={{
                height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
                border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px',
                color: 'var(--text-primary)', fontFamily: 'var(--font)',
              }}>
                <option value="">Selecciona el carrier de este tarifario…</option>
                {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {selectedCarrierId && carrierGeographies.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--alert-text)' }}>
                  Este carrier no tiene ninguna geografía configurada — agrégala en Carriers antes de subir su tarifario.
                </div>
              )}

              {selectedCarrierId && carrierGeographies.length === 1 && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Geografía: <strong style={{ color: 'var(--text-primary)' }}>{GEOGRAPHY_LABELS[carrierGeographies[0]] || carrierGeographies[0]}</strong>
                </div>
              )}

              {selectedCarrierId && carrierGeographies.length > 1 && (
                <select value={geography} onChange={e => setGeography(e.target.value)} style={{
                  height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
                  border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px',
                  color: 'var(--text-primary)', fontFamily: 'var(--font)',
                }}>
                  <option value="">Este tarifario es para qué geografía…</option>
                  {carrierGeographies.map(g => <option key={g} value={g}>{GEOGRAPHY_LABELS[g] || g}</option>)}
                </select>
              )}

              <div
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) validateAndSetFile(f); }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => document.getElementById('tarifario-file-input').click()}
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
                      <button
                        onClick={e => { e.stopPropagation(); handleUploadSubmit(); }}
                        disabled={!selectedCarrierId || !geography || uploadStatus === 'loading'}
                        title={!selectedCarrierId ? 'Selecciona un carrier primero' : !geography ? 'Selecciona la geografía de este tarifario' : ''}
                        style={{
                          height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)',
                          background: selectedCarrierId && geography ? 'var(--accent-primary)' : 'var(--border-input)',
                          color: selectedCarrierId && geography ? '#FFFFFF' : 'var(--text-secondary)', border: 'none',
                          fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font)',
                          cursor: selectedCarrierId && geography && uploadStatus !== 'loading' ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {uploadStatus === 'loading' ? 'Subiendo…' : 'Subir archivo'}
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
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Arrastra tu Excel de tarifarios aquí</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>.xlsx</div>
                    <div style={{
                      height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)',
                      color: '#FFFFFF', display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 700,
                    }}>
                      Subir archivo
                    </div>
                  </>
                )}
                <input id="tarifario-file-input" type="file" accept=".xlsx" onChange={e => { const f = e.target.files[0]; if (f) validateAndSetFile(f); }} style={{ display: 'none' }} />
              </div>

              {uploadError && (
                <div style={{ fontSize: '13px', color: 'var(--alert-text)' }}>{uploadError}</div>
              )}

              {uploadStatus === 'success' && uploadResult && (
                <div style={{ fontSize: '12px', color: 'var(--success-text)' }}>
                  {uploadResult.inserted} tarifas cargadas.
                  {uploadResult.skipped?.length > 0 && ` ${uploadResult.skipped.length} columna(s) de equipo no reconocidas — revisa el nombre.`}
                </div>
              )}
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

const TRow = ({ header, cols, widths = '1.4fr 1fr 1fr 1fr' }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: widths,
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
