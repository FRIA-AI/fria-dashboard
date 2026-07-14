import { LogOut, Send, BarChart2, Clock, MessageSquare, FileUp } from 'lucide-react';
import { logout } from '../auth';

const NAV = [
  { id: 'rfq',     label: 'New Quote',  icon: Send,      adminOnly: false },
  { id: 'history', label: 'My History', icon: Clock,     adminOnly: false },
  { id: 'chat',    label: 'Chat with FRIA', icon: MessageSquare, adminOnly: true  },
  { id: 'ratecards', label: 'Rate Cards',     icon: FileUp,        adminOnly: true  },
  { id: 'metrics', label: 'Metrics',      icon: BarChart2,     adminOnly: true  },
];

export default function Sidebar({ user, activeTab, setActiveTab }) {
  function handleLogout() {
    logout();
    window.location.reload();
  }

  const visibleNav = NAV.filter(item => !item.adminOnly || user.role === 'admin');

  return (
    <aside style={{
      width: 'var(--sidebar-width)', background: 'var(--navy)', display: 'flex',
      flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#EAF0FB', letterSpacing: '3px', marginBottom: '16px' }}>
          FRIA
        </div>
        <div style={{
          background: 'rgba(77,142,255,0.12)', border: '1px solid rgba(77,142,255,0.25)',
          borderRadius: '6px', padding: '5px 10px',
          color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.04em'
        }}>
          FRIA · Rate Intelligence Agent
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px' }}>
        {visibleNav.map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: 'var(--radius-md)', border: 'none',
              background: active ? 'rgba(77,142,255,0.14)' : 'transparent',
              color: active ? '#4D8EFF' : 'rgba(255,255,255,0.45)',
              fontSize: '13px', fontWeight: active ? '600' : '400',
              cursor: 'pointer', transition: 'all var(--transition)', textAlign: 'left',
              marginBottom: '2px', fontFamily: 'var(--font)'
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}}
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
            width: '34px', height: '34px', borderRadius: '50%',
            background: '#4D8EFF', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: '600', flexShrink: 0
          }}>{user.initials}</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: 'white', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>
              {user.role === 'admin' ? 'Manager' : 'Commercial'}
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 12px', borderRadius: 'var(--radius-md)', border: 'none',
          background: 'transparent', color: 'rgba(255,255,255,0.3)',
          fontSize: '13px', cursor: 'pointer', transition: 'all var(--transition)', fontFamily: 'var(--font)'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
