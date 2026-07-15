import { useState, useEffect } from 'react';
import { getSession } from './auth';
import LoginPage from './pages/LoginPage';
import SetPasswordPage from './pages/SetPasswordPage';
import Sidebar from './components/Sidebar';
import RFQPage from './pages/RFQPage';
import HistoryPage from './pages/HistoryPage';
import MetricsPage from './pages/MetricsPage';
import ChatPage from './pages/ChatPage';
import RateCardsPage from './pages/RateCardsPage';
import CarriersPage from './pages/CarriersPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('rfq');
  const [mounted, setMounted] = useState(false);

  const isAuthCallback = window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery');

  useEffect(() => {
    const session = getSession();
    if (session) setUser(session);
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isAuthCallback) {
    return <SetPasswordPage onDone={() => { window.location.hash = ''; window.location.reload(); }} />;
  }

  if (!user) {
    return <LoginPage onLogin={u => { setUser(u); setActiveTab('rfq'); }} />;
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

