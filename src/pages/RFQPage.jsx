import { useState } from 'react';
import { saveRFQ } from '../store';

const N8N_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook-test/fd5bb4ce-a3d1-44e7-986d-c9e84aae3391';

const EXAMPLES = [
  'Monterrey a Laredo, dry van, 2 unidades',
  'Veracruz a CDMX, 40HC, 1 unidad',
  'Guadalajara a Chicago, reefer, 3 unidades',
];

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

export default function RFQPage({ user, onSellQuote }) {
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

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[-T:]/g, '');
    const suffix = user.id.slice(0, 4).toUpperCase();
    const rfqId = `FRIA-${timestamp}-${suffix}`;
    const lane = extractLane(message);

    const payload = {
      Body: message,
      From: 'whatsapp:dashboard',
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
        id: rfqId, userName: user.name, userId: user.id, message, lane,
        timestamp: new Date().toISOString(), status: 'sent', hasAnalysis: !!data,
      });

      setResult({ rfqId, data, lane, message });
      setStatus('success');
      setMessage('');
    } catch (err) {
      setError('No se pudo conectar con FRIA. Intenta de nuevo en un momento.');
      setStatus('error');
    }
  }

  if (status === 'success' && result) {
    return <ComparativaView result={result} userEmail={user.email} onNewQuote={() => { setStatus('idle'); setResult(null); }} onSellQuote={onSellQuote} />;
  }

  return (
    <div style={{
      padding: '56px', display: 'flex', flexDirection: 'column', gap: '24px',
      maxWidth: '820px', margin: '0 auto',
    }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Pídele una cotización a FRIA
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Describe la ruta y el equipo en lenguaje natural — FRIA arma el RFQ y contacta a los carriers.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {EXAMPLES.map((ex, i) => (
          <button key={i} onClick={() => setMessage(ex)} style={{
            padding: '10px 16px', borderRadius: '20px', border: '1px solid var(--border-input)',
            fontSize: '13px', color: 'var(--text-tertiary)', background: 'var(--bg-card)',
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>
            {ex}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder='Escribe tu solicitud, ej. "Necesito 2 dry van de Monterrey a Laredo saliendo el jueves"...'
          rows={5}
          style={{
            width: '100%', height: '150px', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-card)', border: '1px solid var(--border-input)',
            padding: '20px', fontSize: '14px', color: 'var(--text-primary)',
            resize: 'vertical', outline: 'none', lineHeight: 1.6, fontFamily: 'var(--font)',
          }}
        />

        {error && (
          <div style={{ fontSize: '13px', color: 'var(--alert-text)', textAlign: 'center' }}>{error}</div>
        )}

        <button type="submit" disabled={!message.trim() || status === 'loading'} style={{
          alignSelf: 'center', height: '46px', padding: '0 30px', borderRadius: 'var(--radius-md)',
          background: message.trim() ? 'var(--accent-primary)' : 'var(--border-input)',
          color: message.trim() ? '#FFFFFF' : 'var(--text-secondary)',
          border: 'none', fontSize: '14px', fontWeight: 700,
          cursor: message.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)',
        }}>
          {status === 'loading' ? 'Enviando…' : 'Enviar a FRIA'}
        </button>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Enviando como <strong>{user.name}</strong> · el análisis llegará a <strong>{user.email}</strong>
        </div>
      </form>
    </div>
  );
}

function timeAgo(iso) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  return `hace ${hrs} h`;
}

function ComparativaView({ result, userEmail, onNewQuote, onSellQuote }) {
  const carriers = result.data?.carriers || result.data?.analysis?.carriers || [];
  const sorted = [...carriers].sort((a, b) => a.price - b.price);

  return (
    <div style={{ padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
        padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {result.lane || 'Solicitud enviada'}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {result.rfqId} · enviado {timeAgo(new Date().toISOString())}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '28px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          RFQ enviado a los carriers — el análisis comparativo llegará a <strong>{userEmail}</strong> conforme respondan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sorted.map((c, i) => {
            const isWinner = i === 0 && c.price;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 22px', borderRadius: 'var(--radius-lg)',
                background: isWinner ? 'var(--success-bg)' : 'var(--bg-card)',
                border: `1px solid ${isWinner ? 'var(--success-text)' : 'var(--border-card)'}`,
              }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: isWinner ? 700 : 600, color: 'var(--text-primary)' }}>
                    {c.name}
                  </div>
                  {isWinner && (
                    <div style={{ fontSize: '12px', color: 'var(--success-text)', fontWeight: 600, marginTop: '2px' }}>
                      Recomendado · mejor tarifa disponible
                    </div>
                  )}
                  {c.note && !isWinner && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                      {c.note}
                    </div>
                  )}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: '19px', fontWeight: 700,
                  color: isWinner ? 'var(--success-text)' : 'var(--text-tertiary)',
                }}>
                  {c.price ? `${c.currency || '$'}${c.price.toLocaleString()}` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          disabled={!sorted.length}
          title={sorted.length ? '' : 'Disponible cuando haya al menos una cotización'}
          onClick={() => {
            if (!sorted.length || !onSellQuote) return;
            const winner = sorted[0];
            const [origin, destination] = (result.lane || ' → ').split(' → ');
            onSellQuote({
              quoteNumber: result.rfqId,
              origin: origin || '—',
              destination: destination || '—',
              equipment: null,
              carrierName: winner.name,
              baseRate: winner.price || 0,
              currency: winner.currency || 'MXN',
              validUntil: null,
              transitDays: null,
              quoteId: null,
              returnTo: 'rfq',
            });
          }}
          style={{
            height: '46px', padding: '0 26px', borderRadius: 'var(--radius-md)',
            background: sorted.length ? 'var(--accent-primary)' : 'var(--border-input)',
            color: sorted.length ? '#FFFFFF' : 'var(--text-secondary)',
            border: 'none', fontSize: '14px', fontWeight: 700,
            cursor: sorted.length ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)',
          }}
        >
          Armar cotización de venta →
        </button>
        <button onClick={onNewQuote} style={{
          height: '46px', padding: '0 20px', borderRadius: 'var(--radius-md)',
          background: 'none', border: '1px solid var(--border-input)', color: 'var(--text-primary)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
        }}>
          Nueva cotización
        </button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px', padding: '18px 22px',
        borderRadius: 'var(--radius-lg)', background: 'var(--bg-panel)', border: '1px solid rgba(46,91,168,.3)',
      }}>
        <svg width="120" height="46" viewBox="0 0 120 46" style={{ flexShrink: 0, opacity: 0.6 }}>
          <polyline points="0,36 20,30 40,32 60,18 80,22 100,10 120,14" fill="none" stroke="var(--accent-primary)" strokeWidth="2" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Agrega Market Intelligence</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Ve benchmarks de mercado en tiempo real para esta ruta.
          </div>
        </div>
      </div>
    </div>
  );
}
