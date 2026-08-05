import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import LoginPage from './pages/LoginPage';
import SetPasswordPage from './pages/SetPasswordPage';
import TopNav, { canAccessTab } from './components/TopNav';
import HomePage from './pages/HomePage';
import RFQPage from './pages/RFQPage';
import HistoryPage from './pages/HistoryPage';
import MetricsPage from './pages/MetricsPage';
import ChatPage from './pages/ChatPage';
import RateCardsPage from './pages/RateCardsPage';
import CarriersPage from './pages/CarriersPage';
import SettingsPage from './pages/SettingsPage';
import SellQuotePage from './pages/SellQuotePage';
import AdminTenantOnboardingPage from './pages/AdminTenantOnboardingPage';

function initials(firstName, lastName) {
  const a = (firstName || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  return (a + b).toUpperCase() || '?';
}

function getInitialTab() {
  const params = new URLSearchParams(window.location.search);
  return params.has('connected') ? 'settings' : 'home';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [mounted, setMounted] = useState(false);
  const [sellContext, setSellContext] = useState(null);
  const [isFriaStaff, setIsFriaStaff] = useState(false);

  function goToSellQuote(context) {
    setSellContext(context);
    setActiveTab('sell-quote');
  }

  async function checkFriaStaff(session) {
    if (!session) { setIsFriaStaff(false); return; }
    try {
      const res = await fetch('/api/admin/am-i-staff', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setIsFriaStaff(!!data.isStaff);
    } catch {
      setIsFriaStaff(false);
    }
  }

  const isAuthCallback = window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery');

  async function loadProfile(session) {
    if (!session) {
      setUser(null);
      setMounted(true);
      return;
    }
    const { data: profile, error } = await supabase
      .from('tenant_users')
      .select('id, first_name, last_name, role, email')
      .eq('auth_user_id', session.user.id)
      .single();

    if (error || !profile) {
      setUser({
        id: session.user.id,
        tenantUserId: null,
        name: session.user.email,
        email: session.user.email,
        role: 'sales',
        initials: '?',
      });
    } else {
      setUser({
        id: session.user.id,
        tenantUserId: profile.id,
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        email: profile.email,
        role: profile.role,
        initials: initials(profile.first_name, profile.last_name),
      });
    }
    setMounted(true);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session);
      checkFriaStaff(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
      checkFriaStaff(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Verificacion real de permisos por rol -- no basta con esconder el boton
  // del menu, si alguien llega a una pestana restringida por cualquier otro
  // medio, se regresa a Inicio automaticamente.
  useEffect(() => {
    if (user && !canAccessTab(user.role, activeTab)) {
      setActiveTab('home');
    }
  }, [user, activeTab]);

  if (!mounted) return null;

  if (isAuthCallback) {
    return <SetPasswordPage onDone={() => { window.location.hash = ''; }} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav user={user} activeTab={activeTab} setActiveTab={setActiveTab} isFriaStaff={isFriaStaff} />
      <main style={{ flex: 1, overflowY: activeTab === 'chat' ? 'hidden' : 'auto', background: 'var(--bg-page)' }}>
        {activeTab === 'home'      && <HomePage user={user} setActiveTab={setActiveTab} />}
        {activeTab === 'rfq'       && <RFQPage user={user} onSellQuote={goToSellQuote} />}
        {activeTab === 'history'   && <HistoryPage user={user} onSellQuote={goToSellQuote} />}
        {activeTab === 'metrics'   && <MetricsPage user={user} />}
        {activeTab === 'chat'      && <ChatPage user={user} />}
        {activeTab === 'ratecards' && <RateCardsPage user={user} />}
        {activeTab === 'carriers'  && <CarriersPage user={user} />}
        {activeTab === 'settings'  && <SettingsPage user={user} />}
        {activeTab === 'sell-quote' && <SellQuotePage user={user} context={sellContext} setActiveTab={setActiveTab} />}
        {activeTab === 'admin-onboarding' && isFriaStaff && <AdminTenantOnboardingPage />}
      </main>
    </div>
  );
}
