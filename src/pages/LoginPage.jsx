import { useState } from 'react';
import { login } from '../auth';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const user = login(email.trim().toLowerCase(), password);
      if (user) {
        onLogin(user);
      } else {
        setError('Incorrect email or password');
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--navy)', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(232,69,44,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.03) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: '400px', padding: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <svg width="36" height="36" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="32" fontSize="32" fontWeight="700" fill="white" fontFamily="DM Sans, sans-serif">N</text>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: 'white', fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px', lineHeight: 1 }}>Noatum</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Logistics</div>
            </div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(232,69,44,0.15)', border: '1px solid rgba(232,69,44,0.3)',
            borderRadius: '100px', padding: '6px 16px'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--coral)', animation: 'pulse 2s infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: '500', letterSpacing: '0.05em' }}>NORA — Operations & Rate Analyzer</span>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-xl)',
          padding: '36px 32px'
        }}>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: '600', marginBottom: '6px' }}>Welcome back</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', marginBottom: '28px' }}>Sign in to your commercial dashboard</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '500', letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@noatumlogistics.com"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'white', fontSize: '14px',
                  outline: 'none', transition: 'border-color var(--transition)'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(232,69,44,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '500', letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'white', fontSize: '14px',
                  outline: 'none', transition: 'border-color var(--transition)'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(232,69,44,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(232,69,44,0.15)', border: '1px solid rgba(232,69,44,0.3)',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
                color: '#ff8570', fontSize: '13px', marginBottom: '16px'
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: 'var(--coral)', border: 'none',
              borderRadius: 'var(--radius-md)', padding: '13px', color: 'white',
              fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1, transition: 'all var(--transition)',
              fontFamily: 'var(--font)'
            }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px', marginTop: '24px' }}>
          Noatum Logistics · Internal Tool · {new Date().getFullYear()}
        </p>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
