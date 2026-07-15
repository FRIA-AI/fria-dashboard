import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import LoginPage from './pages/LoginPage';
import SetPasswordPage from './pages/SetPasswordPage';
import Sidebar from './components/Sidebar';
import RFQPage from './pages/RFQPage';
import HistoryPage from './pages/HistoryPage';
import MetricsPage from './pages/MetricsPage';
import ChatPage from './pages/ChatPage';
import RateCardsPage from './pages/RateCardsPage';
import CarriersPage from './pages/CarriersPage';

function initials(firstName, lastName) {
  const a = (firstName || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  return (a + b).toUpperCase() || '?';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('rfq');
  const [mounted, setMounted] = useState(false);

  const isAuthCallback = window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery');

  async function loadProfile(session) {
    if (!session) {
      setUser(null);
      setMounted(true);
      return;
    }
    const { data: profile, error } = await supabase
      .from('tenant_users')
      .select('first_name, last_name, role, email')
      .eq('auth_user_id', session.user.id)
      .single();

    if (error || !profile) {
      // Sesion valida en Supabase pero sin fila de perfil ligada todavia.
      setUser({
        id: session.user.id,
        name: session.user.email,
        email: session.user.email,
        role: 'sales',
        initials: '?',
      });
    } else {
      setUser({
        id: session.user.id,
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        email: profile.email,
        role: profile.role,
        initials: initials(profile.first_name, profile.last_name),
      });
    }
    setMounted(true);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!mounted) return null;

  if (isAuthCallback) {
    return <SetPasswordPage onDone={() => { window.location.hash = ''; }} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar user={user} activeTab={activeTab} setActiveTab={setActiveTab} />
      <main style={{ flex: 1, overflowY: activeTab === 'chat' ? 'hidden' : 'auto', background: 'var(--bg)' }}>
        {activeTab === 'rfq'       && <RFQPage user={user} />}
        {activeTab === 'history'   && <HistoryPage user={user} />}
        {activeTab === 'metrics'   && <MetricsPage user={user} />}
        {activeTab === 'chat'      && <ChatPage user={user} />}
        {activeTab === 'ratecards' && <RateCardsPage user={user} />}
        {activeTab === 'carriers'  && <CarriersPage user={user} />}
      </main>
    </div>
  );
}
