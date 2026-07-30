import { useState } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';

const CARRIER_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook-test/carrier-ingestion';

export default function CarriersPage({ user }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
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
    if (ext !== 'xlsx') {
      setError('Only Excel (.xlsx) files are supported. Download the template below.');
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

      const res = await fetch(CARRIER_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setResult(data);
      setStatus('success');
      setFile(null);
    } catch (e) {
      setError('Could not connect to FRIA. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>Carrier Database</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Upload your approved carrier list. Re-uploading updates existing carriers by name instead of duplicating them.
        </p>
      </div>

      <a
        href="/carrier-template.xlsx"
        download
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          fontSize: '13px', color: 'var(--coral)', textDecoration: 'none',
          marginBottom: '24px', fontWeight: '500'
        }}
      >
        <Download size={14} /> Download carrier template (.xlsx)
      </a>

      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '24px' }}>
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => document.getElementById('carrier-file-input').click()}
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
                Drop your carrier list here or click to browse
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Excel (.xlsx) only — use the template above</p>
              <input id="carrier-file-input" type="file" accept=".xlsx" onChange={handleFileInput} style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '14px 16px'
            }}>
              <FileText size={20} style={{ color: 'var(--coral)', flexShrink: 0 }} />
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
            <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: '#991b1b' }}>{error}</p>
          </div>
        )}

        <div style={{ padding: '16px 24px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Uploading as <strong style={{ color: 'var(--text-secondary)' }}>{user.name}</strong>
          </p>
          <button
            onClick={handleSubmit}
            disabled={!file || status === 'loading'}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: file ? 'var(--coral)' : 'var(--border)',
              color: file ? 'white' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 22px',
              fontSize: '14px', fontWeight: '600', cursor: file ? 'pointer' : 'not-allowed',
              transition: 'all var(--transition)', fontFamily: 'var(--font)'
            }}
          >
            {status === 'loading'
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
              : <><Upload size={15} /> Upload Carriers</>
            }
          </button>
        </div>
      </div>

      {status === 'success' && result && (
        <div style={{
          marginTop: '20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 24px', background: 'var(--success-bg)', borderBottom: '1px solid rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#15803d' }}>Import complete</p>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', gap: '28px' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: '600', color: 'var(--success)' }}>{result.inserted}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>new carriers</p>
            </div>
            <div>
              <p style={{ fontSize: '24px', fontWeight: '600', color: 'var(--navy)' }}>{result.updated}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>updated</p>
            </div>
            <div>
              <p style={{ fontSize: '24px', fontWeight: '600', color: result.errorCount > 0 ? '#d97706' : 'var(--text-muted)' }}>{result.errorCount}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>errors</p>
            </div>
          </div>
          {result.errorCount > 0 && (
            <div style={{ margin: '0 24px 20px', padding: '12px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: '12px', color: '#92400e', whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)' }}>{result.errorList}</p>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
