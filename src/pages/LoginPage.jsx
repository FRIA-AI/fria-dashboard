import { useState } from 'react';
import { supabase } from '../supabaseClient';

function FriaMark({ height = 24 }) {
  const heights = [0.40, 0.65, 1.00, 0.80, 0.55];
  const colors = ['#0A0F1F', '#2E5BA8', '#4D8EFF', '#7BA7EE', '#0A0F1F'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: `${height}px` }}>
      {heights.map((h, i) => (
        <div key={i} style={{ width: '6px', height: `${h * 100}%`, background: colors[i], borderRadius: '1px' }} />
      ))}
    </div>
  );
}

const CARRIERS_PREVIEW = [
  { name: 'ALCOSA', price: '$27,900', winner: true },
  { name: 'Falcon Freight', price: '$29,650', winner: false },
  { name: 'Trucka USA', price: '$31,020', winner: false },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      return;
    }
    // No hace falta hacer nada mas aqui: App.jsx escucha el cambio de sesion
    // via supabase.auth.onAuthStateChange y actualiza la pantalla solo.
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-page)', padding: '32px', fontFamily: 'var(--font)',
    }}>
      <div style={{
        width: '100%', maxWidth: '1100px', minHeight: '620px', display: 'flex',
        borderRadius: '14px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(10,15,31,.18)',
      }}>
        {/* Panel izquierdo — formulario */}
        <div style={{
          width: '46%', background: 'var(--bg-card)', padding: '64px 56px',
          display: 'flex', flexDirection: 'column', gap: '32px', justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <FriaMark />
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>FRIA</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Freight Rate Intelligence Dashboard
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Inicia sesión para cotizar en segundos.
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Correo</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="tu@empresa.com"
                style={{
                  height: '46px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                  border: '1px solid var(--border-input)', padding: '0 14px', fontSize: '14px',
                  color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••••"
                style={{
                  height: '46px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                  border: '1px solid var(--border-input)', padding: '0 14px', fontSize: '14px',
                  color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', letterSpacing: '.2em',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--alert-bg)', border: '1px solid var(--alert-text)', borderRadius: 'var(--radius-md)',
                padding: '10px 14px', color: 'var(--alert-text)', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              height: '46px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)',
              border: 'none', color: '#FFFFFF', fontSize: '14px', fontWeight: 700,
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.75 : 1, fontFamily: 'var(--font)',
            }}>
              {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>

          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            FRIA · friaai.com · {new Date().getFullYear()}
          </div>
        </div>

        {/* Panel derecho — vista previa ilustrativa */}
        <div style={{
          width: '54%', background: 'var(--bg-panel)', padding: '56px',
          display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center',
          borderLeft: '1px solid var(--border-card)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.06em', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
            FRIA — Análisis en vivo
          </div>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
            padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Veracruz → CDMX</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>40HC · 3 carriers evaluados</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {CARRIERS_PREVIEW.map(c => (
                <div key={c.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  background: c.winner ? 'var(--success-bg)' : 'var(--bg-panel)',
                  border: c.winner ? '1px solid var(--success-text)' : 'none',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: c.winner ? 600 : 400, color: c.winner ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {c.name}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: c.winner ? 700 : 400,
                    color: c.winner ? 'var(--success-text)' : 'var(--text-tertiary)',
                  }}>
                    {c.price}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Solicita cotizaciones · Compara carriers · Da seguimiento a tu equipo
          </div>
        </div>
      </div>
    </div>
  );
}
