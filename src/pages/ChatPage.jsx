import { useState, useRef, useEffect } from 'react';

const CHAT_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook/fria-chat';

function equipLabel(e) {
  return (e || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function MiniCard({ label, value, tone }) {
  const color = tone === 'success' ? 'var(--success-text)' : tone === 'accent' ? 'var(--accent-primary)' : 'var(--text-primary)';
  return (
    <div style={{
      flex: 1, minWidth: '120px', padding: '10px 12px', borderRadius: 'var(--radius-md)',
      background: 'var(--bg-panel)', border: '1px solid var(--border-card)',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 700, color, marginTop: '3px' }}>
        {value}
      </div>
    </div>
  );
}

// Renderiza las mini-tarjetas + aviso de fase 2 + pie de confidencialidad que
// acompañan una respuesta del Chat cuando trae datos de mercado reales.
function MarketDataBlock({ data, onChip }) {
  if (!data) return null;
  const hasRoute = data.origin && data.destination;

  return (
    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {data.mediana != null && (
          <MiniCard label="Mediana mercado" value={`$${Number(data.mediana).toLocaleString()}`} tone="accent" />
        )}
        {data.tu_mejor_costo != null && (
          <MiniCard label="Tu mejor costo" value={`$${Number(data.tu_mejor_costo).toLocaleString()}`} tone="success" />
        )}
        {(data.point_count != null || data.tenant_count != null) && (
          <MiniCard
            label="Base del cálculo"
            value={`${data.point_count ?? '—'} datos · ${data.tenant_count ?? '—'} fuentes`}
          />
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px',
        borderRadius: 'var(--radius-md)', background: '#FDF6E7', border: '1px solid rgba(185,138,32,.35)',
      }}>
        <span style={{
          width: '15px', height: '15px', borderRadius: '4px', background: '#B98A20', color: '#FFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0, marginTop: '1px',
        }}>!</span>
        <span style={{ fontSize: '11.5px', color: '#5A4413', lineHeight: 1.5 }}>
          La tendencia del mercado completo (cómo se mueve semana a semana) es fase 2 — todavía no hay suficiente
          historial acumulado.
        </span>
      </div>

      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', paddingTop: '10px', borderTop: '1px solid var(--border-card)' }}>
        Este dato combina información de toda la red de FRIA — nunca se muestra de qué empresa vino cada tarifa.
      </div>

      {hasRoute && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            `¿Qué carriers cubren ${data.origin} → ${data.destination}?`,
            `¿Cómo se compara mi tarifario en esa ruta?`,
            `¿Cuáles han sido mis cotizaciones recientes ahí?`,
          ].map((chip, i) => (
            <button key={i} onClick={() => onChip(chip)} style={{
              padding: '7px 12px', borderRadius: '20px', border: '1px solid var(--border-input)',
              background: 'var(--bg-card)', color: 'var(--accent-primary)', fontSize: '11.5px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}>
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSend(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const newHistory = [...messages, { role: 'user', content: text }];
    setMessages(newHistory);
    setInput('');
    setSending(true);
    setError('');

    try {
      const res = await fetch(CHAT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          // el historial ANTES de este mensaje -- solo prosa, sin los datos
          // estructurados de mercado, FRIA no necesita verlos dos veces
          history: messages.map(m => ({ role: m.role, content: m.content })),
          userEmail: user?.email || '',
        }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setMessages([...newHistory, {
        role: 'fria',
        content: data.reply || 'No obtuve respuesta.',
        marketData: data.marketData || null,
      }]);
    } catch (e) {
      setError('No se pudo conectar con FRIA. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 64px', display: 'flex',
        flexDirection: 'column', gap: '18px', maxWidth: '920px', margin: '0 auto', width: '100%',
      }}>
        {messages.length === 0 && (
          <div style={{
            alignSelf: 'center', marginTop: '40px', textAlign: 'center',
            fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: 1.6,
          }}>
            Pregúntale a FRIA sobre tus tarifarios, cotizaciones, carriers, desempeño de tu equipo, o el índice de
            mercado FRAI — responde con tus datos reales, no con ejemplos.
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} style={{
                alignSelf: 'flex-end', maxWidth: '70%', background: 'var(--accent-primary)',
                borderRadius: '14px 14px 4px 14px', padding: '14px 18px',
                fontSize: '14px', color: '#FFFFFF', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            );
          }
          return (
            <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '.04em' }}>
                FRIA
              </div>
              <div style={{
                background: '#FFFFFF', border: '1px solid var(--border-card)', borderRadius: '4px 14px 14px 14px',
                padding: '14px 18px', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                boxShadow: '0 1px 3px rgba(10,15,31,.06)',
              }}>
                {m.content}
                <MarketDataBlock data={m.marketData} onChip={(chip) => handleSend(chip)} />
              </div>
            </div>
          );
        })}

        {sending && (
          <div style={{ alignSelf: 'flex-start', fontSize: '12px', color: 'var(--text-secondary)' }}>
            FRIA está consultando tus datos…
          </div>
        )}

        {error && (
          <div style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--alert-text)' }}>{error}</div>
        )}

        <div ref={scrollRef} />
      </div>

      <div style={{ padding: '24px 64px 32px', display: 'flex', justifyContent: 'center', marginTop: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '920px', display: 'flex', gap: '10px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder="Escribe tu pregunta a FRIA..."
            style={{
              height: '50px', flex: 1, borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)', border: '1px solid var(--border-input)', padding: '0 18px',
              fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font)', outline: 'none',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            style={{
              height: '50px', padding: '0 24px', borderRadius: 'var(--radius-lg)',
              background: input.trim() && !sending ? 'var(--accent-primary)' : 'var(--border-input)',
              color: input.trim() && !sending ? '#FFFFFF' : 'var(--text-secondary)', border: 'none',
              fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font)',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
            }}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
