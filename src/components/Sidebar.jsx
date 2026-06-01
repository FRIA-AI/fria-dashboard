import { LogOut, Send, BarChart2, Clock } from 'lucide-react';
import { logout } from '../auth';

const NAV = [
  { id: 'rfq',     label: 'New Quote',  icon: Send },
  { id: 'history', label: 'My History', icon: Clock },
  { id: 'metrics', label: 'Metrics',    icon: BarChart2 },
];

export default function Sidebar({ user, activeTab, setActiveTab }) {
  function handleLogout() {
    logout();
    window.location.reload();
  }

  return (
    <aside style={{
      width: 'var(--sidebar-width)', background: 'var(--navy)', display: 'flex',
      flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--coral)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '14px', fontWeight: '700' }}>N</span>
          </div>
          <div>
            <div style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>Noatum</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Logistics</div>
          </div>
        </div>
        <div style={{
          background: 'rgba(232,69,44,0.12)', border: '1px solid rgba(232,69,44,0.25)',
          borderRadius: '6px', padding: '5px 10px',
          color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.04em'
        }}>
          NORA · Rate Analyzer
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 12px' }}>
        {NAV.map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: 'var(--radius-md)', border: 'none',
              background: active ? 'rgba(232,69,44,0.18)' : 'transparent',
              color: active ? '#ff8570' : 'rgba(255,255,255,0.5)',
              fontSize: '13px', fontWeight: active ? '600' : '400',
              cursor: 'pointer', transition: 'all var(--transition)', textAlign: 'left',
              marginBottom: '2px', fontFamily: 'var(--font)'
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', marginBottom: '8px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--coral)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: '600', flexShrink: 0
          }}>{user.initials}</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: 'white', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Commercial</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 12px', borderRadius: 'var(--radius-md)', border: 'none',
          background: 'transparent', color: 'rgba(255,255,255,0.35)',
          fontSize: '13px', cursor: 'pointer', transition: 'all var(--transition)', fontFamily: 'var(--font)'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
