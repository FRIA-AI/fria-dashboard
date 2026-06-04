import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, User, AlertCircle, CheckCircle, XCircle, ChevronRight, Zap } from 'lucide-react';
import { getNORAContext } from '../airtable';

const CHAT_URL = '/api/chat';

const SUGGESTED = [
  'Show me all active carriers',
  'Which carriers cover Monterrey?',
  'What are the best rates for CDMX to Guadalajara?',
  'Show me the last 10 quotes received',
  'Which lane has the most quotes?',
  'Add a new carrier to the system',
];

// ─── System Prompt Builder ────────────────────────────────────────
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

  return `You are NORA (Noatum Operations & Rate Analyzer) — the intelligent operations AI for Noatum Logistics Mexico (MX1 ROA Road Freight). You are like Jarvis from Iron Man: you analyze, recommend, and execute actions on behalf of the user.

## YOUR CAPABILITIES
1. ANALYZE: Query and analyze live data from Airtable (carriers, quotes, historical rates)
2. EXECUTE: Trigger RFQs, create records, update carriers — but ALWAYS show a plan first
3. RECOMMEND: Proactively identify issues, opportunities, and optimizations

## CRITICAL WORKFLOW FOR ACTIONS
When the user asks you to DO something (not just query data), you MUST:
1. First call the "show_action_plan" tool to present a clear step-by-step plan
2. Wait for user approval before executing anything
3. Only after approval, use the appropriate execution tool

## PERSONALITY
- Professional, direct, and data-driven — like a senior ops analyst
- Always respond in English
- Give actionable insights, not just raw data
- Think proactively: if you see a problem in the data, mention it
- You are autonomous but transparent — always explain what you're doing and why

## LIVE DATA (as of right now)

### CARRIERS (${context.carriers.length} total)
${carriersText || 'No carriers found'}

### RECENT QUOTES (last 50)
${quotesText || 'No quotes found'}

### HISTORICAL RATES (last 50)
${historicalText || 'No historical rates found'}

## AVAILABLE ACTIONS (require user approval)
- request_quote: Trigger RFQ to carriers via n8n
- create_historical_rate: Save a rate to Historical Rates
- add_carrier: Add a new carrier to the database
- update_carrier: Modify an existing carrier record
- execute_n8n_workflow: Trigger n8n workflows directly
- get_quotes_by_lane: Query quotes with filters

## SYSTEM CONTEXT
- Airtable Base: app8TKlzHRkSiHgnH
- n8n: roadnlmx.app.n8n.cloud
- Banxico FIX rate: 17.3793 MXN/USD
- Primary contact: adolfo.romero@noatumlogistics.com

## CITY NORMALIZATION
- CDMX = Ciudad de Mexico = Mexico City = DF
- MTY = Monterrey = MONTERREY CENTRO
- GDL = Guadalajara
- VER = Veracruz

## COVERAGE LOGIC
- "Todos los estados de la república" or "Nacional" = covers ALL Mexico
- Always include national carriers when answering coverage questions

## FORMATTING
- Use markdown tables for comparing carriers or rates
- Use bullet points for lists
- Bold important numbers
- Keep responses focused and actionable
- NEVER say "Welcome" or introduce yourself after the first message`;
}

// ─── Action Plan Component ────────────────────────────────────────
function ActionPlanCard({ plan, toolUseId, toolName, toolInput, onApprove, onReject, loading }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '2px solid #1B2A4A',
      borderRadius: '12px',
      overflow: 'hidden',
      maxWidth: '90%',
    }}>
      {/* Header */}
      <div style={{
        background: '#1B2A4A',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Zap size={16} style={{ color: '#E8452C' }} />
        <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>Action Plan</span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginLeft: '4px' }}>{plan.title}</span>
      </div>

      {/* Steps */}
      <div style={{ padding: '16px' }}>
        {plan.steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            marginBottom: i < plan.steps.length - 1 ? '12px' : '0',
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#1B2A4A',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: '700',
              flexShrink: 0,
            }}>{step.step}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                {step.action} <span style={{ color: '#E8452C' }}>→ {step.target}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{step.details}</div>
            </div>
          </div>
        ))}

        {plan.warning && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#92400e',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}>
            <AlertCircle size={14} />
            {plan.warning}
          </div>
        )}

        {/* Approval Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            onClick={() => onApprove({ tool_use_id: toolUseId, name: toolName, input: toolInput })}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px',
              background: '#1B2A4A',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
            Approve & Execute
          </button>
          <button
            onClick={onReject}
            disabled={loading}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <XCircle size={14} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────
function MessageBubble({ msg, onApprove, onReject, approvingId }) {
  const isUser = msg.role === 'user';

  if (msg.type === 'action_plan') {
    return (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: 'var(--navy)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={14} style={{ color: '#E8452C' }} />
        </div>
        <div style={{ flex: 1 }}>
          {msg.text && (
            <div style={{
              marginBottom: '10px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              lineHeight: '1.6',
            }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
          )}
          <ActionPlanCard
            plan={msg.plan}
            toolUseId={msg.tool_use_id}
            toolName={msg.pending_tool_name}
            toolInput={msg.pending_tool_input}
            onApprove={onApprove}
            onReject={onReject}
            loading={approvingId === msg.tool_use_id}
          />
        </div>
      </div>
    );
  }

  if (msg.type === 'tool_result') {
    return (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: '#16a34a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle size={14} style={{ color: 'white' }} />
        </div>
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '4px 12px 12px 12px',
          padding: '12px 16px',
          fontSize: '14px',
          color: '#166534',
          lineHeight: '1.6',
        }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
      </div>
    );
  }

  if (msg.type === 'cancelled') {
    return (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: '#9ca3af',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <XCircle size={14} style={{ color: 'white' }} />
        </div>
        <div style={{
          background: '#f9fafb',
          border: '1px solid var(--border)',
          borderRadius: '4px 12px 12px 12px',
          padding: '10px 14px',
          fontSize: '13px',
          color: 'var(--text-muted)',
        }}>Action cancelled.</div>
      </div>
    );
  }

  const rendered = renderMarkdown(msg.content || '');

  return (
    <div style={{
      display: 'flex', gap: '12px', alignItems: 'flex-start',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
        background: isUser ? '#E8452C' : 'var(--navy)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser ? <User size={14} style={{ color: 'white' }} /> : <Sparkles size={14} style={{ color: '#E8452C' }} />}
      </div>
      <div style={{
        maxWidth: '75%',
        background: isUser ? '#E8452C' : 'var(--bg-card)',
        border: isUser ? 'none' : '1px solid var(--border)',
        borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        padding: '12px 16px', fontSize: '14px', lineHeight: '1.6',
        color: isUser ? 'white' : 'var(--text-primary)', boxShadow: 'var(--shadow-sm)',
      }} dangerouslySetInnerHTML={{ __html: rendered }} />
    </div>
  );
}

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(27,42,74,0.08);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>')
    .split('\n').join('<br/>');
}

// ─── Main ChatPage ────────────────────────────────────────────────
export default function ChatPage({ user }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      type: 'text',
      content: `Hi ${user.name.split(' ')[0]}! I'm NORA, your operations AI. I have live access to carriers, quotes, and historical rates — and I can take actions on your behalf.\n\nWhat would you like to do?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState(null);

  // Track pending tool calls that need execution after approval
  const pendingToolRef = useRef(null);

  const bottomRef = useRef(null);

  useEffect(() => { loadContext(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadContext() {
    setLoadingContext(true);
    try {
      const ctx = await getNORAContext();
      setContext(ctx);
    } catch (e) {
      setError('Could not load Airtable data.');
    } finally {
      setLoadingContext(false);
    }
  }

  async function sendMessage(text, approvedToolCall = null) {
    if (!text.trim() && !approvedToolCall || loading) return;

    let newMessages = [...messages];

    if (text.trim()) {
      const userMsg = { role: 'user', type: 'text', content: text };
      newMessages = [...newMessages, userMsg];
      setMessages(newMessages);
      setInput('');
    }

    setLoading(true);
    setError('');

    try {
      const systemPrompt = context ? buildSystemPrompt(context) : 'You are NORA, the Noatum Logistics operations AI.';

      // Build history for API (only user/assistant text messages)
      const history = newMessages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.type === 'text')
        .map(m => ({ role: m.role, content: m.content }));

      const body = {
        history,
        system: systemPrompt,
      };

      if (approvedToolCall) {
        body.approved_tool_call = approvedToolCall;
      }

      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.type === 'action_plan') {
        // NORA wants to show a plan — store the next tool to execute after approval
        pendingToolRef.current = {
          tool_use_id: data.tool_use_id,
          // The actual execution tool will come in the next Claude response after approval
          // For now store what we know
        };

        setMessages(prev => [...prev, {
          role: 'assistant',
          type: 'action_plan',
          plan: data.plan,
          tool_use_id: data.tool_use_id,
          pending_tool_name: null, // plan approval doesn't need a tool execution
          pending_tool_input: null,
          text: data.text,
        }]);

        // After showing plan, send a follow-up so Claude can proceed to the actual tool call
        // We inject the plan approval into the conversation
        await proceedAfterPlanApproval(data, newMessages, systemPrompt);

      } else if (data.type === 'pending_approval') {
        // Direct tool execution pending approval (shouldn't happen with show_action_plan flow, but handle it)
        setMessages(prev => [...prev, {
          role: 'assistant',
          type: 'action_plan',
          plan: {
            title: data.tool_name,
            steps: [{ step: 1, action: data.tool_name, target: 'System', details: JSON.stringify(data.tool_input) }],
          },
          tool_use_id: data.tool_use_id,
          pending_tool_name: data.tool_name,
          pending_tool_input: data.tool_input,
          text: data.text,
        }]);

      } else {
        // Normal text response
        setMessages(prev => [...prev, {
          role: 'assistant',
          type: 'text',
          content: data.text,
        }]);
      }

    } catch (e) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // After showing the action plan, get Claude to produce the actual tool call
  async function proceedAfterPlanApproval(planData, prevMessages, systemPrompt) {
    // We need to tell Claude the plan was shown and ask it to now produce the execution tool call
    // This is handled by the approval flow — we wait for user to click Approve
    // Store context for when they do
    pendingToolRef.current = {
      planShown: true,
      planData,
      prevMessages,
      systemPrompt,
    };
  }

  async function handleApprove(toolCall) {
    setApprovingId(toolCall.tool_use_id);

    try {
      // If this is a plan approval (show_action_plan tool), send to Claude to get next tool
      if (!toolCall.name || toolCall.name === null) {
        // Plan was shown — now ask Claude to execute
        await executeAfterPlanApproval(toolCall);
        return;
      }

      // Direct tool execution
      const res = await fetch('/api/nora-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: toolCall.name, input: toolCall.input }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages(prev => {
          // Replace the action_plan message with a result
          const updated = prev.map(m =>
            m.tool_use_id === toolCall.tool_use_id
              ? { ...m, type: 'executed' }
              : m
          );
          return [...updated, {
            role: 'assistant',
            type: 'tool_result',
            content: `✅ **Done!** ${data.result?.message || 'Action completed successfully.'}`,
          }];
        });
        // Reload context to reflect changes
        loadContext();
      } else {
        setError(`Action failed: ${data.error}`);
      }
    } catch (e) {
      setError('Failed to execute action.');
    } finally {
      setApprovingId(null);
    }
  }

  async function executeAfterPlanApproval(toolCall) {
    // User approved the plan — now send back to Claude with plan result so it calls the actual tool
    const pending = pendingToolRef.current;
    if (!pending) return;

    setLoading(true);

    try {
      const approvedToolCall = {
        tool_use_id: toolCall.tool_use_id,
        name: 'show_action_plan',
        input: pending.planData?.plan || {},
      };

      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: pending.prevMessages
            .filter(m => (m.role === 'user' || m.role === 'assistant') && m.type === 'text')
            .map(m => ({ role: m.role, content: m.content })),
          system: pending.systemPrompt,
          approved_tool_call: approvedToolCall,
        }),
      });

      const data = await res.json();

      if (data.type === 'pending_approval' || data.type === 'action_plan') {
        // Claude now wants to execute the real tool
        setMessages(prev => {
          const updated = prev.map(m =>
            m.tool_use_id === toolCall.tool_use_id
              ? { ...m, type: 'executed' }
              : m
          );
          return [...updated, {
            role: 'assistant',
            type: 'action_plan',
            plan: data.plan || {
              title: data.tool_name,
              steps: [{ step: 1, action: data.tool_name, target: 'System', details: JSON.stringify(data.tool_input) }],
            },
            tool_use_id: data.tool_use_id,
            pending_tool_name: data.tool_name,
            pending_tool_input: data.tool_input,
            text: data.text,
          }];
        });
      } else if (data.type === 'text') {
        setMessages(prev => {
          const updated = prev.map(m =>
            m.tool_use_id === toolCall.tool_use_id
              ? { ...m, type: 'executed' }
              : m
          );
          return [...updated, {
            role: 'assistant',
            type: 'text',
            content: data.text,
          }];
        });
        loadContext();
      }
    } catch (e) {
      setError('Failed to proceed after approval.');
    } finally {
      setLoading(false);
      setApprovingId(null);
    }
  }

  function handleReject() {
    setMessages(prev => {
      // Mark the last action_plan as cancelled
      const lastPlanIdx = [...prev].reverse().findIndex(m => m.type === 'action_plan');
      if (lastPlanIdx === -1) return prev;
      const idx = prev.length - 1 - lastPlanIdx;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], type: 'executed' };
      return [...updated, { role: 'assistant', type: 'cancelled' }];
    });
    pendingToolRef.current = null;
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      maxWidth: '800px', margin: '0 auto', padding: '0 24px',
    }}>
      {/* Header */}
      <div style={{ padding: '24px 0 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} style={{ color: '#E8452C' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
              NORA
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loadingContext ? (
                <>
                  <Loader2 size={11} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading data...</span>
                </>
              ) : context ? (
                <>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {context.carriers.length} carriers · {context.quotes.length} quotes · {context.historical.length} rates · Actions enabled
                  </span>
                </>
              ) : (
                <>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#d97706' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Airtable not connected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 0',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {messages.filter(m => m.type !== 'executed').map((msg, i) => (
          <MessageBubble
            key={i}
            msg={msg}
            onApprove={handleApprove}
            onReject={handleReject}
            approvingId={approvingId}
          />
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Sparkles size={14} style={{ color: '#E8452C' }} />
            </div>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '14px 18px',
              display: 'flex', gap: '5px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: 'var(--text-muted)',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', background: '#fef2f2',
            border: '1px solid #fca5a5', borderRadius: '8px',
          }}>
            <AlertCircle size={14} style={{ color: '#dc2626' }} />
            <span style={{ fontSize: '13px', color: '#991b1b' }}>{error}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested */}
      {messages.length === 1 && (
        <div style={{ flexShrink: 0, paddingBottom: '12px' }}>
          <p style={{
            fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px',
          }}>Suggested</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SUGGESTED.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '100px', padding: '6px 14px', fontSize: '12px',
                color: 'var(--text-secondary)', cursor: 'pointer',
                transition: 'all 150ms', fontFamily: 'var(--font)',
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
          borderRadius: '12px', padding: '10px 10px 10px 16px', boxShadow: 'var(--shadow-sm)',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask NORA anything or give her an action to execute..."
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '14px', color: 'var(--text-primary)', resize: 'none',
              fontFamily: 'var(--font)', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: '36px', height: '36px', borderRadius: '8px', border: 'none',
              background: input.trim() ? '#E8452C' : 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 150ms', flexShrink: 0,
            }}
          >
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
