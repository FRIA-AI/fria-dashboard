import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function GoogleMark() {
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
      background: 'conic-gradient(#4D8EFF 0 25%, #2E5BA8 0 50%, #7BA7EE 0 75%, #0A0F1F 0 100%)',
    }} />
  );
}

function MicrosoftMark() {
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
      display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '2px', padding: '6px',
      background: '#FFFFFF', border: '1px solid var(--border-card)',
    }}>
      <div style={{ background: '#F25022' }} />
      <div style={{ background: '#7FBA00' }} />
      <div style={{ background: '#00A4EF' }} />
      <div style={{ background: '#FFB900' }} />
    </div>
  );
}

const PROVIDERS = {
  google: { label: 'Google', markComponent: GoogleMark, connectLabel: 'Conectar con Google', startPath: '/api/auth/google/start', disconnectPath: '/api/auth/google/disconnect' },
  microsoft: { label: 'Microsoft', markComponent: MicrosoftMark, connectLabel: 'Conectar con Microsoft', startPath: '/api/auth/microsoft/start', disconnectPath: '/api/auth/microsoft/disconnect' },
};

const GUIDE_STEPS = {
  google: [
    'Haz clic en "Conectar con Google" arriba.',
    'Selecciona la cuenta de Gmail de la empresa (la que va a mandar y recibir las cotizaciones con los carriers).',
    'Es normal ver una pantalla que dice "Google no verificó esta app" — es porque FRIA es una app nueva, no significa que algo esté mal. Haz clic en "Avanzado" y luego en "Ir a FRIA (no seguro)".',
    'Google te va a pedir confirmar dos permisos (enviar correos y leer/organizar tu bandeja). Acepta ambos — sin esto FRIA no puede mandar ni leer respuestas de RFQs.',
    'Te va a regresar automáticamente a esta pantalla, ahora mostrando "Conectado" con el correo y la fecha.',
  ],
  microsoft: [
    'Haz clic en "Conectar con Microsoft" arriba.',
    'Inicia sesión con la cuenta de Outlook o Microsoft 365 de la empresa (la que va a mandar y recibir las cotizaciones con los carriers) — funciona tanto con cuentas de empresa como con Outlook.com personales.',
    'Microsoft te va a mostrar los permisos que pide FRIA (enviar correos y leer tu bandeja). Acepta para continuar — sin esto FRIA no puede mandar ni leer respuestas de RFQs.',
    'Te va a regresar automáticamente a esta pantalla, ahora mostrando "Conectado" con el correo y la fecha.',
  ],
};

export default function SettingsPage() {
  const [status, setStatus] = useState('loading'); // loading | disconnected | connected | error
  const [provider, setProvider] = useState(null); // 'google' | 'microsoft' | null
  const [email, setEmail] = useState('');
  const [connectedAt, setConnectedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  async function loadStatus() {
    setStatus('loading');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStatus('error'); return; }

    try {
      const res = await fetch('/api/tenant-email-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.connected) {
        setProvider(data.provider);
        setEmail(data.email);
        setConnectedAt(data.connectedAt);
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function handleConnect(providerKey) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    window.location.href = `${PROVIDERS[providerKey].startPath}?accessToken=${encodeURIComponent(session.access_token)}`;
  }

  async function handleDisconnect() {
    if (!provider) return;
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBusy(false); return; }

    try {
      await fetch(PROVIDERS[provider].disconnectPath, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await loadStatus();
    } finally {
      setBusy(false);
    }
  }

  const fecha = connectedAt
    ? new Date(connectedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const ConnectedMark = provider ? PROVIDERS[provider].markComponent : null;

  return (
    <div style={{
      padding: '56px var(--page-pad-x)', display: 'flex', flexDirection: 'column',
      gap: '24px', maxWidth: '760px', margin: '0 auto',
    }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
        Conectar tu correo
      </div>

      {status === 'loading' && (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando estado de conexión…</div>
      )}

      {status === 'error' && (
        <div style={{
          background: 'var(--alert-bg)', color: 'var(--alert-text)', borderRadius: 'var(--radius-lg)',
          padding: '20px 24px', fontSize: '13px',
        }}>
          No pudimos confirmar el estado de tu conexión. Intenta recargar la página.
        </div>
      )}

      {status === 'disconnected' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-lg)',
          padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Sin conectar
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Conecta el correo de tu empresa para que FRIA pueda enviar y leer respuestas de RFQs automáticamente.
            Elige el que uses — Gmail/Google Workspace, u Outlook/Microsoft 365.
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {Object.entries(PROVIDERS).map(([key, p]) => {
              const Mark = p.markComponent;
              return (
                <button key={key} onClick={() => handleConnect(key)} style={{
                  flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: '14px',
                  height: '64px', padding: '0 18px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-input)', background: 'var(--bg-panel)',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <Mark />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>
                    {p.connectLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {status === 'connected' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--success-text)', borderRadius: 'var(--radius-lg)',
          padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Conectado · {provider ? PROVIDERS[provider].label : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {ConnectedMark && <ConnectedMark />}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{email}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Conectado desde el {fecha}
                </div>
              </div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: '20px',
              fontSize: '12px', fontWeight: 600, background: 'var(--success-bg)', color: 'var(--success-text)',
            }}>
              Conectado
            </span>
          </div>
          <button onClick={handleDisconnect} disabled={busy} style={{
            alignSelf: 'flex-start', height: '40px', padding: '0 18px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-input)', background: 'none', color: 'var(--text-primary)',
            fontSize: '13px', fontWeight: 600, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'var(--font)', opacity: busy ? 0.6 : 1,
          }}>
            {busy ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      )}

      <div style={{
        fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6,
        borderTop: '1px solid var(--border-card)', paddingTop: '20px',
      }}>
        Solo pedimos permiso para enviar y leer correos relacionados a RFQs — nunca tocamos el resto de tu bandeja.
      </div>

      <div>
        <button onClick={() => setShowGuide(s => !s)} style={{
          background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '13px',
          fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', padding: 0,
        }}>
          {showGuide ? '▾ Ocultar guía paso a paso' : '▸ Ver guía paso a paso'}
        </button>

        {showGuide && (
          <div style={{
            marginTop: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px',
          }}>
            {Object.entries(GUIDE_STEPS).map(([key, steps]) => (
              <div key={key}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                  Cómo conectar {PROVIDERS[key].label}
                </div>
                <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {steps.map((step, i) => (
                    <li key={i} style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
            <div style={{
              paddingTop: '14px', borderTop: '1px solid var(--border-card)',
              fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
              Si necesitas desconectar y volver a conectar (por ejemplo, para cambiar de cuenta o de proveedor), usa el botón "Desconectar" primero y repite estos pasos.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
