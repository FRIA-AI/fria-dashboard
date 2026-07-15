import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function SetPasswordPage({ onDone }) {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // supabase-js ya parseo el hash de la URL (access_token/refresh_token) solo,
    // via detectSessionInUrl. Solo confirmamos que la sesion quedo activa.
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0F1F' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Verifying your invitation link...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0F1F', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#EAF0FB', letterSpacing: '4px', marginBottom: '8px', textAlign: 'center' }}>
          FRIA
        </div>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', textAlign: 'center', marginBottom: '32px' }}>
          Set your password to finish creating your account.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '8px', textTransform: 'uppercase' }}>New password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '13px 16px', color: 'white', fontSize: '14px', outline: 'none'
              }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '8px', textTransform: 'uppercase' }}>Confirm password</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '13px 16px', color: 'white', fontSize: '14px', outline: 'none'
              }}
            />
          </div>
          {error && (
            <div style={{ background: 'rgba(77,142,255,0.15)', border: '1px solid rgba(77,142,255,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#a8c8ff', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', background: '#4D8EFF', border: 'none', borderRadius: '8px', padding: '14px',
            color: 'white', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            {loading ? 'Saving...' : 'Set password & continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
