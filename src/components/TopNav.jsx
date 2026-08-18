import { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Matriz explicita de que rol ve que pantalla -- mas facil de leer y de
// extender que un simple "adminOnly: true/false". Se exporta para que
// App.jsx pueda usar la misma matriz como verificacion real, no solo para
// ocultar el boton del menu.
export const NAV = [
  { id: 'home',      label: 'Inicio',     roles: ['admin', 'sales', 'pricing', 'readonly'] },
  { id: 'rfq',       label: 'Pricing',    roles: ['admin', 'sales', 'pricing'] },
  { id: 'history',   label: 'Historial',  roles: ['admin', 'sales', 'pricing'] },
  { id: 'ratecards', label: 'Tarifarios', roles: ['admin', 'pricing'] },
  { id: 'carriers',  label: 'Carriers',   roles: ['admin'] },
    { id: 'metrics',   label: 'Métricas',   roles: ['admin', 'readonly'] },
  { id: 'market-intel', label: 'Inteligencia de Mercado', roles: ['admin', 'sales', 'pricing', 'readonly'] },
  { id: 'chat',      label: 'Chat',       roles: ['admin'] },
];

// Pantallas restringidas por rol que NO viven en la barra de navegacion
// principal (se acceden por otro camino, ej. el menu del avatar) -- se
// revisan aparte para no mezclarlas con los botones visibles de arriba.
const EXTRA_TAB_ROLES = {
  settings: ['admin'], // Conectar Gmail -- solo el admin del tenant debe poder tocar la bandeja compartida
};

export function canAccessTab(role, tabId) {
  const item = NAV.find(n => n.id === tabId);
  if (item) return item.roles.includes(role);
  if (EXTRA_TAB_ROLES[tabId]) return EXTRA_TAB_ROLES[tabId].includes(role);
  return true; // pantallas sin restriccion por rol (sell-quote; admin-onboarding se controla aparte con isFriaStaff)
}

function FriaMark({ height = 22 }) {
  const heights = [0.40, 0.65, 1.00, 0.80, 0.55];
  const colors = ['#0A0F1F', '#2E5BA8', '#4D8EFF', '#7BA7EE', '#0A0F1F'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: `${height}px` }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: '6px', height: `${h * 100}%`,
          background: colors[i], borderRadius: '1px',
        }} />
      ))}
    </div>
  );
}

export default function TopNav({ user, activeTab, setActiveTab, isFriaStaff }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const visibleNav = NAV.filter(item => item.roles.includes(user.role));

  return (
    <header style={{
      height: 'var(--nav-height)', background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-card)', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FriaMark />
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>FRIA</div>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '26px' }}>
          {visibleNav.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font)', fontSize: '13px', fontWeight: 600,
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  padding: '4px 0',
                  borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  transition: `color var(--transition)`,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: 'var(--accent-primary)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font)',
          }}
        >
          {user.initials}
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: '44px', right: 0, width: '220px',
            background: 'var(--bg-card)', border: '1px solid var(--border-input)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
            padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 20,
          }}>
            <div style={{
              padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border-card)', marginBottom: '4px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user.email}
            </div>
            {user.role === 'admin' && (
              <button
                onClick={() => { setActiveTab('settings'); setMenuOpen(false); }}
                style={{
                  padding: '9px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
                  fontWeight: 500, color: 'var(--text-primary)', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-panel)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                Configuración
              </button>
            )}
            {isFriaStaff && (
              <button
                onClick={() => { setActiveTab('admin-onboarding'); setMenuOpen(false); }}
                style={{
                  padding: '9px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
                  fontWeight: 500, color: 'var(--text-primary)', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-panel)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                Onboarding FRIA
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                padding: '9px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px',
                fontWeight: 600, color: 'var(--alert-text)', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--alert-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
