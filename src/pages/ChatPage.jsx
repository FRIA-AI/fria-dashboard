import { useState, useRef, useEffect } from 'react';

const CHAT_WEBHOOK_URL = 'https://roadnlmx.app.n8n.cloud/webhook-test/fria-chat';

export default function ChatPage({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
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
          history: messages, // el historial ANTES de este mensaje, FRIA no necesita verlo dos veces
          userEmail: user?.email || '',
        }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setMessages([...newHistory, { role: 'fria', content: data.reply || 'No obtuve respuesta.' }]);
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
            Pregúntale a FRIA sobre tus tarifarios, cotizaciones, carriers o desempeño de tu equipo —
            responde con tus datos reales, no con ejemplos.
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} style={{
                alignSelf: 'flex-start', maxWidth: '70%', background: 'var(--bg-card)',
                border: '1px solid var(--border-card)', borderRadius: '12px', padding: '14px 18px',
                fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            );
          }
          return (
            <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textAlign: 'right', letterSpacing: '.04em' }}>
                FRIA
              </div>
              <div style={{
                background: 'var(--bg-panel)', border: '1px solid rgba(46,91,168,.25)', borderRadius: '12px',
                padding: '14px 18px', fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            </div>
          );
        })}

        {sending && (
          <div style={{ alignSelf: 'flex-end', fontSize: '12px', color: 'var(--text-secondary)' }}>
            FRIA está consultando tus datos…
          </div>
        )}

        {error && (
          <div style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--alert-text)' }}>{error}</div>
        )}

        <div ref={scrollRef} />
      </div>

      <div style={{ padding: '24px 64px 32px', display: 'flex', justifyContent: 'center' }}>
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
            onClick={handleSend}
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
