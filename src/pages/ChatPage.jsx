import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, User, AlertCircle } from 'lucide-react';
import { getNORAContext } from '../airtable';

const N8N_CHAT_URL = '/api/chat';

const SUGGESTED = [
  'Show me all active carriers',
  'Which carriers cover Monterrey?',
  'What are the best rates for CDMX to Guadalajara?',
  'Show me the last 10 quotes received',
  'Which lane has the most quotes?',
  'Compare carriers for Veracruz to CDMX',
];

function buildSystemPrompt(context) {
  const carriersText = context.carriers.map(c => {
    const yards = (c['Yards'] || 'N/A').replace(/\n/g, ', ').trim();
    const equipment = Array.isArray(c['Equipment Types']) ? c['Equipment Types'].join(', ') : (c['Equipment Types'] || 'N/A');
    const service = Array.isArray(c['Service Type']) ? c['Service Type'].join(', ') : (c['Service Type'] || 'N/A');
    return `- ${c['Carrier Name'] || 'Unknown'}: equipment=${equipment}, yards=${yards}, email=${c['Main Email'] || 'N/A'}, language=${c['Language'] || 'N/A'}, status=${c['Active/Inactive'] || 'active'}, service=${service}`;
  }).join('\n');

  const quotesText = context.quotes.slice(0, 50).map(q =>
    `- ${q['Carrier Name'] || q.carrier || 'Unknown'}: ${q.Origin || q.origin} → ${q.Destination || q.destination}, ${q.Equipment || q.equipment}, ${q.Currency || 'MXN'} ${q.Price || q.price}, date=${q['Response Date'] || q.date || 'N/A'}`
  ).join('\n');

  const historicalText = context.historical.slice(0, 50).map(h =>
    `- ${h['Carrier Name'] || h.carrier || 'Unknown'}: ${h.Origin || h.origin} → ${h.Destination || h.destination}, ${h.Equipment || h.equipment}, ${h.Currency || 'MXN'} ${h.Price || h.price}, transit=${h['Transit Time'] || 'N/A'}`
  ).join('\n');

  return `You are NORA (Noatum Operations & Rate Analyzer), the intelligent freight pricing assistant for Noatum Logistics. You have direct access to the company's live data from Airtable.

## YOUR PERSONALITY
- Professional, concise, and data-driven
- Always respond in English
- When showing data, use clear tables or lists
- Give actionable insights, not just raw data
- You know the freight industry deeply

## LIVE DATA (as of right now)

### CARRIERS (${context.carriers.length} total)
${carriersText || 'No carriers found'}

### RECENT QUOTES (last 50)
${quotesText || 'No quotes found'}

### HISTORICAL RATES (last 50)
${historicalText || 'No historical rates found'}

## WHAT YOU CAN DO
- Analyze carrier performance and coverage
- Compare rates across lanes
- Identify patterns in quotes and historical data
- Give recommendations on which carrier to use for a specific lane
- Summarize activity by lane, carrier, or time period
- Flag carriers that are slow to respond or consistently expensive

## CRITICAL RULES
- NEVER introduce yourself or say "Welcome" or "Hello" after the first message
- NEVER repeat who you are or what you can do after the conversation has started
- If the user is asking a question, just answer it directly — no preamble
- The conversation history is provided — use it to maintain context
- Respond ONLY to what was asked

## CITY NAME NORMALIZATION
These city names are equivalent — always match them regardless of how they're written:
- CDMX = Ciudad de Mexico = CIUDAD DE MEXICO = Mexico City = DF = Ciudad de México
- MTY = Monterrey = MONTERREY CENTRO = MONTERREY COSTA
- GDL = Guadalajara
- VER = Veracruz
- When searching rates, always check ALL variants of a city name

## COVERAGE LOGIC
- Carriers with Yards = "Todos los estados de la república" or "Nacional" cover ALL states in Mexico including Veracruz, CDMX, Monterrey, Guadalajara, etc.
- Always include national-coverage carriers when answering coverage questions about any Mexican state or city
- When listing carriers for a location, include both: carriers with that specific location in their Yards AND carriers with national coverage

## FORMATTING
- Use markdown tables when showing multiple carriers or rates
- Use bullet points for lists
- Bold important numbers and carrier names
- Keep responses focused and actionable`;
}

export default function ChatPage({ user }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi ${user.name.split(' ')[0]}! I'm NORA, your rate analyzer. I have live access to your carriers, quotes, and historical rates.\n\nWhat would you like to know?`,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => { loadContext(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadContext() {
    setLoadingContext(true);
    try {
      const ctx = await getNORAContext();
      // DEBUG: log first carrier to see exact field names
      if (ctx.carriers.length > 0) {
        console.log('CARRIER FIELDS:', JSON.stringify(Object.keys(ctx.carriers[0])));
        console.log('CARRIER SAMPLE:', JSON.stringify(ctx.carriers[0]));
      }
      setContext(ctx);
    } catch (e) {
      setError('Could not load Airtable data.');
    } finally {
      setLoadingContext(false);
    }
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const systemPrompt = context ? buildSystemPrompt(context) : 'You are NORA, the Noatum Logistics rate analyzer.';

      // Send full conversation history so NORA has memory
      const history = newMessages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(N8N_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history,
          system: systemPrompt,
        }),
      });

      const data = await res.json();
      const reply = data.text || data.output || data.response || JSON.stringify(data);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>

      {/* Header */}
      <div style={{ padding: '24px 0 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} style={{ color: '#E8452C' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>Chat with NORA</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loadingContext ? (
                <><Loader2 size={11} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading Airtable data...</span></>
              ) : context ? (
                <><div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }} /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{context.carriers.length} carriers · {context.quotes.length} quotes · {context.historical.length} historical rates loaded</span></>
              ) : (
                <><div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#d97706' }} /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Airtable not connected</span></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {loading && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={14} style={{ color: '#E8452C' }} />
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', display: 'flex', gap: '5px', alignItems: 'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--text-muted)', animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
            <AlertCircle size={14} style={{ color: '#dc2626' }} />
            <span style={{ fontSize: '13px', color: '#991b1b' }}>{error}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length === 1 && (
        <div style={{ flexShrink: 0, paddingBottom: '12px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Suggested</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SUGGESTED.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '100px', padding: '6px 14px', fontSize: '12px',
                color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 150ms', fontFamily: 'var(--font)'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8452C'; e.currentTarget.style.color = '#E8452C'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ flexShrink: 0, paddingBottom: '24px' }}>
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'flex-end',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '10px 10px 10px 16px', boxShadow: 'var(--shadow-sm)'
        }}>
          <textarea
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask NORA anything about your carriers, rates, or lanes..."
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '14px', color: 'var(--text-primary)', resize: 'none',
              fontFamily: 'var(--font)', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto'
            }}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} style={{
            width: '36px', height: '36px', borderRadius: '8px', border: 'none',
            background: input.trim() ? '#E8452C' : 'var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'not-allowed', transition: 'all 150ms', flexShrink: 0
          }}>
            <Send size={15} style={{ color: input.trim() ? 'white' : 'var(--text-muted)' }} />
          </button>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const rendered = msg.content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(27,42,74,0.08);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>')
    .split('\n').join('<br/>');

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
        background: isUser ? '#E8452C' : 'var(--navy)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {isUser ? <User size={14} style={{ color: 'white' }} /> : <Sparkles size={14} style={{ color: '#E8452C' }} />}
      </div>
      <div style={{
        maxWidth: '75%', background: isUser ? '#E8452C' : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border)',
        borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        padding: '12px 16px', fontSize: '14px', lineHeight: '1.6',
        color: isUser ? 'white' : 'var(--text-primary)', boxShadow: 'var(--shadow-sm)'
      }} dangerouslySetInnerHTML={{ __html: rendered }} />
    </div>
  );
}
