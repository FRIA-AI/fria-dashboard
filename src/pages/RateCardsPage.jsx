import { useState } from 'react';
import { Upload, FileText, Table, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { getRecords } from '../airtable';
import { useState as useStateEffect, useEffect } from 'react';

const WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook/nora-tarifarios';

export default function RateCardsPage({ user }) {
  const [carriers, setCarriers] = useState([]);
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getRecords('Carriers').then(data => {
      const active = data
        .filter(c => c['Active/Inactive'] === 'Active')
        .map(c => c['Carrier Name'])
        .filter(Boolean)
        .sort();
      setCarriers(active);
    }).catch(() => {});
  }, []);

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
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Only PDF, Excel (.xlsx, .xls) and CSV files are supported.');
      return;
    }
    setError('');
    setFile(f);
  }

  async function handleSubmit() {
    if (!file || !selectedCarrier) return;
    setStatus('loading');
    setError('');
    setResult(null);

    try {
      const fileType = file.name.split('.').pop().toLowerCase() === 'pdf' ? 'pdf' : 'xlsx';
      
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierName: selectedCarrier,
          fileType,
          fileName: file.name,
          fileData: base64,
          uploadedBy: user.name,
          uploadedAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      setResult(data);
      setStatus('success');
      setFile(null);
      setSelectedCarrier('');
    } catch (e) {
      setError('Could not connect to NORA. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>Rate Card Import</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Upload a carrier rate card (PDF or Excel) and NORA will extract all routes and rates automatically.
        </p>
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
              color: selectedCarrier ? 'var(--text-primary)' : 'var(--text-muted)',
              outline: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'border-color var(--transition)'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--coral)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          >
            <option value="">Select a carrier...</option>
            {carriers.map(c => <option key={c} value={c}>{c}</option>)}
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
                background: dragging ? 'rgba(232,69,44,0.03)' : 'var(--bg)',
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

        {/* Error */}
        {error && (
          <div style={{ margin: '0 24px 16px', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-md)' }}>
            <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: '#991b1b' }}>{error}</p>
          </div>
        )}

        {/* Submit */}
        <div style={{ padding: '16px 24px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            NORA will extract all routes and add them to Historical Rates
          </p>
          <button
            onClick={handleSubmit}
            disabled={!file || !selectedCarrier || status === 'loading'}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: file && selectedCarrier ? 'var(--coral)' : 'var(--border)',
              color: file && selectedCarrier ? 'white' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 22px',
              fontSize: '14px', fontWeight: '600', cursor: file && selectedCarrier ? 'pointer' : 'not-allowed',
              transition: 'all var(--transition)', fontFamily: 'var(--font)'
            }}
          >
            {status === 'loading'
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
              : <><Upload size={15} /> Import Rate Card</>
            }
          </button>
        </div>
      </div>

      {/* Success result */}
      {status === 'success' && result && (
        <div style={{
          marginTop: '20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 24px', background: 'var(--success-bg)', borderBottom: '1px solid rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#15803d' }}>Rate card imported successfully</p>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              NORA processed the file and added the rates to Historical Rates in Airtable. You can now use these rates in your quotes and analysis.
            </p>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
