import { useState } from 'react';
import { Upload, FileText, Table, X, Clock } from 'lucide-react';

// TEMPORAL — el botón de importar queda desactivado hasta que exista el workflow
// de n8n de ingesta de tarifarios (Excel-only, Sección 11B.1 del business case).
// La UI se deja completa para que el flujo se sienta real; solo falta conectar
// el selector de carriers a Supabase y el envío al webhook cuando ese workflow exista.

export default function RateCardsPage({ user }) {
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  }

  function handleFileInput(e) {
    const f = e.target.files[0];
    if (f) validateAndSetFile(f);
  }

  function validateAndSetFile(f) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Only PDF, Excel (.xlsx, .xls) and CSV files are supported.');
      return;
    }
    setError('');
    setFile(f);
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>Rate Card Import</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Upload a carrier rate card (PDF or Excel) and FRIA will extract all routes and rates automatically.
        </p>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius-md)',
        padding: '10px 16px', marginBottom: '20px'
      }}>
        <Clock size={15} style={{ color: '#d97706', flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#92400e' }}>Coming soon — imports aren't processed yet. You can explore the flow below.</p>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>

        {/* Carrier selector */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Carrier
          </label>
          <select
            value={selectedCarrier}
            onChange={e => setSelectedCarrier(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '14px',
              color: 'var(--text-muted)', outline: 'none', cursor: 'not-allowed', fontFamily: 'var(--font)'
            }}
            disabled
          >
            <option value="">Carrier list will load once this feature is connected...</option>
          </select>
        </div>

        {/* File drop zone */}
        <div style={{ padding: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Rate Card File
          </label>

          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => document.getElementById('file-input').click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--coral)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', padding: '48px 24px',
                textAlign: 'center', cursor: 'pointer',
                background: dragging ? 'rgba(77,142,255,0.04)' : 'var(--bg)',
                transition: 'all var(--transition)'
              }}
            >
              <Upload size={28} style={{ color: dragging ? 'var(--coral)' : 'var(--text-muted)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Drop your file here or click to browse
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PDF, Excel (.xlsx, .xls) or CSV</p>
              <input id="file-input" type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={handleFileInput} style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '14px 16px'
            }}>
              {file.name.endsWith('.pdf')
                ? <FileText size={20} style={{ color: 'var(--coral)', flexShrink: 0 }} />
                : <Table size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div style={{ margin: '0 24px 16px', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '13px', color: '#991b1b' }}>{error}</p>
          </div>
        )}

        {/* Submit — desactivado a propósito */}
        <div style={{ padding: '16px 24px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            FRIA will extract all routes and add them to your rate history
          </p>
          <button
            disabled
            title="Coming soon"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--border)', color: 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 22px',
              fontSize: '14px', fontWeight: '600', cursor: 'not-allowed', fontFamily: 'var(--font)'
            }}
          >
            <Upload size={15} /> Import Rate Card
          </button>
        </div>
      </div>
    </div>
  );
}
