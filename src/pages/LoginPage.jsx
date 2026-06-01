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
      minHeight: '100vh', display: 'flex',
      background: '#1B2A4A',
    }}>
      <div style={{
        width: '50%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '48px',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(ellipse at 30% 70%, rgba(232,69,44,0.12) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />
        <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
          <div style={{ marginBottom: '48px' }}>
            <img src="/logo-white.png" alt="Noatum Logistics" style={{ height: '36px', marginBottom: '32px' }} />
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '600', lineHeight: 1.2, marginBottom: '10px' }}>
              Commercial<br />Rate Dashboard
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', lineHeight: 1.6 }}>
              Sign in to request freight quotes and<br />access NORA rate analysis.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '8px', textTransform: 'uppercase' }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@noatumlogistics.com"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '13px 16px', color: 'white', fontSize: '14px',
                  outline: 'none', transition: 'border-color 150ms', fontFamily: 'inherit'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(232,69,44,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '8px', textTransform: 'uppercase' }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '13px 16px', color: 'white', fontSize: '14px',
                  outline: 'none', transition: 'border-color 150ms', fontFamily: 'inherit'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(232,69,44,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(232,69,44,0.15)', border: '1px solid rgba(232,69,44,0.3)',
                borderRadius: '8px', padding: '10px 14px',
                color: '#ff8570', fontSize: '13px', marginBottom: '16px'
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: '#E8452C', border: 'none',
              borderRadius: '8px', padding: '14px', color: 'white',
              fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1, transition: 'all 150ms', fontFamily: 'inherit',
              letterSpacing: '0.01em'
            }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', marginTop: '36px', textAlign: 'center' }}>
            Noatum Logistics · Internal use only · {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <div style={{
        width: '50%', background: '#f0f2f5', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '40px', right: '40px', left: '40px',
          background: 'white', borderRadius: '16px', padding: '24px',
          boxShadow: '0 4px 24px rgba(27,42,74,0.1)', border: '1px solid rgba(27,42,74,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#1B2A4A', letterSpacing: '0.05em' }}>NORA — LIVE ANALYSIS</span>
          </div>
          <div style={{ fontSize: '13px', color: '#6b7a95', marginBottom: '16px' }}>Veracruz → CDMX · 40HC · 3 carriers evaluated</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { name: 'Verlogistics', price: 'MXN 18,500', medal: '🥇', color: '#f0fdf4', border: 'rgba(22,163,74,0.2)' },
              { name: 'Lutsa',        price: 'MXN 21,000', medal: '🥈', color: '#f8f9fa', border: 'rgba(27,42,74,0.08)' },
              { name: 'TUM',          price: 'MXN 23,400', medal: '🥉', color: '#f8f9fa', border: 'rgba(27,42,74,0.08)' },
            ].map(c => (
              <div key={c.name} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: c.color, border: `1px solid ${c.border}`,
                borderRadius: '8px', padding: '10px 14px'
              }}>
                <span style={{ fontSize: '14px' }}>{c.medal}</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#1B2A4A', flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1B2A4A', fontFamily: 'DM Mono, monospace' }}>{c.price}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(27,42,74,0.04)', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6b7a95' }}>Price spread: </span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#1B2A4A' }}>26.5%</span>
            <span style={{ fontSize: '12px', color: '#6b7a95' }}> · Sent to jacqueline.cruz@noatumlogistics.com</span>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '40px', left: '40px', right: '40px' }}>
          <p style={{ fontSize: '13px', color: '#9ba8bf', textAlign: 'center' }}>
            Request quotes · Compare carriers · Track your team's activity
          </p>
        </div>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');`}</style>
    </div>
  );
}
