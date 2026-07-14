import { useState } from 'react';
import { Clock, Search, ArrowRight, CheckCircle2, Send, Inbox } from 'lucide-react';
import { getRFQHistory } from '../store';

export default function HistoryPage({ user }) {
  const [search, setSearch] = useState('');
  const allHistory = getRFQHistory();
  const myHistory = allHistory.filter(r => r.userId === user.id);

  const filtered = myHistory.filter(r =>
    !search ||
    r.message?.toLowerCase().includes(search.toLowerCase()) ||
    r.lane?.toLowerCase().includes(search.toLowerCase()) ||
    r.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>My Quote History</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>All quote requests you've submitted through FRIA</p>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by lane, message or RFQ ID..."
          style={{
            width: '100%', paddingLeft: '40px', paddingRight: '16px', paddingTop: '11px', paddingBottom: '11px',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            fontSize: '14px', color: 'var(--text-primary)', outline: 'none',
            transition: 'border-color var(--transition)', fontFamily: 'var(--font)'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--coral)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          padding: '60px 24px', textAlign: 'center'
        }}>
          <Inbox size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
          <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {search ? 'No results found' : 'No quotes yet'}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {search ? 'Try different search terms' : 'Submit your first request in the New Quote tab'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(rfq => <RFQCard key={rfq.id} rfq={rfq} />)}
        </div>
      )}
    </div>
  );
}

function RFQCard({ rfq }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(rfq.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)', overflow: 'hidden',
      transition: 'box-shadow var(--transition)'
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '16px 20px', cursor: 'pointer', display: 'flex',
          alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px'
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <code style={{
              fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--navy)',
              background: 'rgba(10,15,31,0.07)', padding: '2px 8px', borderRadius: '4px'
            }}>{rfq.id}</code>
            {rfq.lane && (
              <span style={{
                fontSize: '12px', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}>
                <ArrowRight size={11} style={{ color: 'var(--coral)' }} />
                {rfq.lane}
              </span>
            )}
          </div>
          <p style={{
            fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4',
            whiteSpace: expanded ? 'normal' : 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {rfq.message}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {rfq.hasAnalysis
              ? <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
              : <Send size={13} style={{ color: 'var(--coral)' }} />
            }
            <span style={{
              fontSize: '11px', fontWeight: '500',
              color: rfq.hasAnalysis ? 'var(--success)' : 'var(--coral)'
            }}>
              {rfq.hasAnalysis ? 'Analysis ready' : 'RFQs sent'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
            <Clock size={11} />
            <span style={{ fontSize: '11px' }}>{formattedDate} · {formattedTime}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', paddingTop: '14px' }}>
            {rfq.message}
          </p>
        </div>
      )}
    </div>
  );
}
