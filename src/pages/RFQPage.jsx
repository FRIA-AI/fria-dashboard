import { useState } from 'react';
import { Send, Loader2, CheckCircle2, AlertCircle, Mail, Clock, ArrowRight } from 'lucide-react';
import { saveRFQ } from '../store';

const N8N_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook/fd5bb4ce-a3d1-44e7-986d-c9e84aae3391';

const EXAMPLES = [
  'Necesito cotización para Guadalajara a Monterrey, carga seca en 53 pies, disponible 15 de julio',
  'Quote for Mexico City to Laredo TX, reefer 48ft, ASAP',
  'Cotización Manzanillo puerto a CDMX, contenedor 40HC, semana que entra',
];

export default function RFQPage({ user }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('loading');
    setError('');
    setResult(null);

    const rfqId = `NORA-${Date.now()}-${new Date().getFullYear()}`;
    const lane = extractLane(message);

    const payload = {
      Body: message,
      From: `whatsapp:dashboard`,
      ProfileName: user.name,
      UserEmail: user.email,
      UserId: user.id,
      RFQId: rfqId,
      Source: 'dashboard',
    };

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      saveRFQ({
        id: rfqId,
        userName: user.name,
        userId: user.id,
        message,
        lane,
        timestamp: new Date().toISOString(),
        status: 'sent',
        hasAnalysis: !!data,
      });

      setResult({ rfqId, data, lane, message });
      setStatus('success');
      setMessage('');
    } catch (err) {
      setError('Could not connect to NORA. Check the webhook URL in config.');
      setStatus('error');
    }
  }

  function extractLane(text) {
    const patterns = [
      /(?:de|from)\s+([\w\s]+?)\s+(?:a|to)\s+([\w\s]+?)(?:\s*,|\s*$)/i,
      /([\w\s]+?)\s+(?:a|to)\s+([\w\s]+?)(?:\s+en|\s+,|\s*$)/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return `${m[1].trim()} → ${m[2].trim()}`;
    }
    return null;
  }

  function useExample(ex) { setMessage(ex); }

  const isDemo = N8N_WEBHOOK_URL === 'YOUR_N8N_WEBHOOK_URL_HERE';

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>New Quote Request</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Write your freight request in free text — NORA will analyze historical data and send RFQs to carriers.
        </p>
      </div>

      {isDemo && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--radius-md)',
          padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '10px'
        }}>
          <AlertCircle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '13px', color: '#92400e', fontWeight: '500' }}>Webhook not configured</p>
            <p style={{ fontSize: '12px', color: '#a16207', marginTop: '2px' }}>
              Open <code style={{ fontFamily: 'var(--mono)', background: '#fef3c7', padding: '1px 4px', borderRadius: '3px' }}>src/pages/RFQPage.jsx</code> and replace <code style={{ fontFamily: 'var(--mono)', background: '#fef3c7', padding: '1px 4px', borderRadius: '3px' }}>YOUR_N8N_WEBHOOK_URL_HERE</code> with your n8n webhook URL.
            </p>
          </div>
        </div>
      )}

      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Examples</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => useExample(ex)} style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '13px',
                cursor: 'pointer', transition: 'all var(--transition)', fontFamily: 'var(--font)'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--coral)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <ArrowRight size={12} style={{ marginRight: '6px', opacity: 0.5 }} />
                {ex}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Your request
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe the freight: origin, destination, equipment type, dates, any special requirements..."
            rows={5}
            style={{
              width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '14px 16px', fontSize: '14px',
              color: 'var(--text-primary)', resize: 'vertical', outline: 'none',
              transition: 'border-color var(--transition)', lineHeight: '1.6', fontFamily: 'var(--font)'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--coral)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Sending as <strong style={{ color: 'var(--text-secondary)', fontWeight:'500' }}>{user.name}</strong> · Analysis will be sent to <strong style={{ color: 'var(--text-secondary)', fontWeight:'500' }}>{user.email}</strong>
            </p>
            <button type="submit" disabled={!message.trim() || status === 'loading'} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: message.trim() ? 'var(--coral)' : 'var(--border)',
              color: message.trim() ? 'white' : 'var(--text-muted)',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 22px',
              fontSize: '14px', fontWeight: '600', cursor: message.trim() ? 'pointer' : 'not-allowed',
              transition: 'all var(--transition)', fontFamily: 'var(--font)'
            }}>
              {status === 'loading' ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : <><Send size={15} /> Send to NORA</>}
            </button>
          </div>
        </form>
      </div>

      {status === 'error' && (
        <div style={{
          marginTop: '20px', background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 'var(--radius-md)', padding: '14px 18px',
          display: 'flex', alignItems: 'flex-start', gap: '10px'
        }}>
          <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '13px', color: '#991b1b' }}>{error}</p>
        </div>
      )}

      {status === 'success' && result && (
        <div style={{ marginTop: '24px' }}>
          <SuccessCard result={result} userEmail={user.email} />
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SuccessCard({ result, userEmail }) {
  const hasAnalysis = result.data && (result.data.carriers || result.data.analysis);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 24px', background: 'var(--success-bg)',
        borderBottom: '1px solid rgba(22,163,74,0.15)',
        display: 'flex', alignItems: 'center', gap: '10px'
      }}>
        <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#15803d' }}>Request sent to NORA</p>
          <p style={{ fontSize: '12px', color: '#166534', marginTop: '1px' }}>ID: <code style={{ fontFamily: 'var(--mono)' }}>{result.rfqId}</code></p>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {result.lane && (
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lane detected:</span>
            <span style={{
              background: 'rgba(27,42,74,0.07)', color: 'var(--navy)', borderRadius: '100px',
              padding: '3px 12px', fontSize: '13px', fontWeight: '500'
            }}>{result.lane}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Mail size={15} style={{ color: 'var(--coral)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>Analysis will arrive by email</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {hasAnalysis
                  ? `Historical data found — initial analysis sent to ${userEmail}`
                  : `RFQs dispatched to carriers. When they respond, you'll receive a full comparative analysis at ${userEmail}`}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Clock size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Carrier responses are monitored every 5 minutes. Updated analysis delivered automatically.
            </p>
          </div>
        </div>

        {hasAnalysis && result.data && (
          <AnalysisPreview data={result.data} />
        )}
      </div>
    </div>
  );
}

function AnalysisPreview({ data }) {
  const carriers = data.carriers || data.analysis?.carriers || [];
  if (!carriers.length) return null;

  const sorted = [...carriers].sort((a, b) => a.price - b.price);
  const min = sorted[0]?.price;
  const max = sorted[sorted.length - 1]?.price;
  const spread = min ? Math.round(((max - min) / min) * 100) : 0;

  return (
    <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
        Quick analysis preview
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.map((c, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: i === 0 ? 'rgba(22,163,74,0.06)' : 'var(--bg)',
            border: `1px solid ${i === 0 ? 'rgba(22,163,74,0.2)' : 'var(--border)'}`
          }}>
            <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}</span>
            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', flex: 1 }}>{c.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: '600', color: i === 0 ? 'var(--success)' : 'var(--text-primary)' }}>
              {c.currency} {c.price?.toLocaleString()}
            </span>
            <span style={{
              fontSize: '11px', padding: '3px 8px', borderRadius: '4px',
              background: c.source === 'Historical Rate' ? 'rgba(27,42,74,0.08)' : 'rgba(232,69,44,0.08)',
              color: c.source === 'Historical Rate' ? 'var(--navy)' : 'var(--coral)', fontWeight: '500'
            }}>{c.source === 'Historical Rate' ? 'Rate Card' : 'Quote'}</span>
          </div>
        ))}
      </div>
      {spread > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Price spread:</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{spread}%</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>· Full analysis sent to your email</span>
        </div>
      )}
    </div>
  );
}
