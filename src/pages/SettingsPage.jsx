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

function SmtpMark() {
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
      background: 'var(--bg-panel)', border: '1px solid var(--border-card)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px', color: 'var(--text-secondary)',
    }}>
      🔑
    </div>
  );
}

const PROVIDERS = {
  google: { label: 'Google', markComponent: GoogleMark, connectLabel: 'Conectar con Google', startPath: '/api/auth/google/start', disconnectPath: '/api/auth/google/disconnect' },
  microsoft: { label: 'Microsoft', markComponent: MicrosoftMark, connectLabel: 'Conectar con Microsoft', startPath: '/api/auth/microsoft/start', disconnectPath: '/api/auth/microsoft/disconnect' },
  smtp: { label: 'Usuario y contraseña', markComponent: SmtpMark },
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
  const [provider, setProvider] = useState(null); // 'google' | 'microsoft' | 'smtp' | null
  const [email, setEmail] = useState('');
  const [connectedAt, setConnectedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSmtpForm, setShowSmtpForm] = useState(false);
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpProvider, setSmtpProvider] = useState('outlook');
  const [manualSmtpHost, setManualSmtpHost] = useState('');
  const [manualSmtpPort, setManualSmtpPort] = useState('587');
  const [manualSmtpSecure, setManualSmtpSecure] = useState(false);
  const [manualImapHost, setManualImapHost] = useState('');
  const [manualImapPort, setManualImapPort] = useState('993');
  const [manualImapSecure, setManualImapSecure] = useState(true);
  const [smtpSubmitting, setSmtpSubmitting] = useState(false);
  const [smtpError, setSmtpError] = useState('');
  const [termsInput, setTermsInput] = useState('');
  const [termsLoaded, setTermsLoaded] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [termsSaved, setTermsSaved] = useState(false);
  const [termsError, setTermsError] = useState('');

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

  useEffect(() => {
    async function loadTerms() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch('/api/tenant-branding', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        setTermsInput(data.customTerms || '');
      } catch {
        // se queda vacio -- el formulario simplemente arranca en blanco
      } finally {
        setTermsLoaded(true);
      }
    }
    loadTerms();
  }, []);

  async function handleSaveTerms() {
    setTermsSaving(true);
    setTermsError('');
    setTermsSaved(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setTermsSaving(false); return; }

    try {
      const res = await fetch('/api/tenant-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ customTerms: termsInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTermsError(data.error || 'No se pudo guardar.');
        return;
      }
      setTermsSaved(true);
    } catch {
      setTermsError('No se pudo conectar con FRIA. Intenta de nuevo.');
    } finally {
      setTermsSaving(false);
    }
  }

  function handleResetTerms() {
    setTermsInput('');
    setTermsSaved(false);
  }

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
      const path = provider === 'smtp' ? '/api/disconnect-smtp' : PROVIDERS[provider].disconnectPath;
      await fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      await loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function handleSmtpSubmit(e) {
    e.preventDefault();
    setSmtpSubmitting(true);
    setSmtpError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSmtpSubmitting(false); return; }

    try {
      const res = await fetch('/api/connect-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          provider: smtpProvider,
          emailAddress: smtpEmail.trim(),
          appPassword: smtpPassword,
          manual: smtpProvider === 'other' ? {
            smtpHost: manualSmtpHost.trim(), smtpPort: manualSmtpPort, smtpSecure: manualSmtpSecure,
            imapHost: manualImapHost.trim(), imapPort: manualImapPort, imapSecure: manualImapSecure,
          } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSmtpError(data.error || 'No se pudo conectar.');
        return;
      }
      setSmtpEmail('');
      setSmtpPassword('');
      setShowSmtpForm(false);
      await loadStatus();
    } catch {
      setSmtpError('No se pudo conectar con FRIA. Intenta de nuevo.');
    } finally {
      setSmtpSubmitting(false);
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
            Elige Google si usas Gmail/Workspace, Microsoft si usas Outlook/M365 — y si prefieres o no puedes
            usar esos botones, más abajo puedes conectar con usuario y contraseña para Outlook, Yahoo, Zoho, o
            cualquier correo de dominio propio.
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {Object.entries(PROVIDERS).filter(([key]) => key !== 'smtp').map(([key, p]) => {
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

          <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '16px' }}>
            <button onClick={() => setShowSmtpForm(s => !s)} style={{
              background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', padding: 0,
            }}>
              {showSmtpForm ? '▾ Ocultar' : '▸ ¿No puedes usar los botones de arriba? Conecta con usuario y contraseña'}
            </button>

            {showSmtpForm && (
              <form onSubmit={handleSmtpSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '460px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>¿Qué proveedor usas?</label>
                  <select value={smtpProvider} onChange={e => setSmtpProvider(e.target.value)} style={{
                    height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                    border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px',
                    color: 'var(--text-primary)', fontFamily: 'var(--font)',
                  }}>
                    <option value="outlook">Outlook / Microsoft 365</option>
                    <option value="yahoo">Yahoo Mail</option>
                    <option value="zoho">Zoho Mail</option>
                    <option value="other">Otro (correo de dominio propio)</option>
                  </select>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {smtpProvider === 'outlook' && (
                    <>
                      <strong>No uses tu contraseña normal</strong> — usa una "contraseña de aplicación": en tu
                      cuenta de Microsoft, ve a{' '}
                      <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>Seguridad</a>{' '}
                      → "Opciones de seguridad avanzadas" → "Contraseñas de aplicación" → crea una nueva, y
                      pégala aquí. Si tu organización usa verificación en dos pasos, tu administrador de TI
                      puede necesitar habilitar esta opción.
                    </>
                  )}
                  {smtpProvider === 'yahoo' && (
                    <>
                      <strong>No uses tu contraseña normal</strong> — Yahoo exige una "contraseña de
                      aplicación": ve a{' '}
                      <a href="https://login.yahoo.com/account/security" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>Seguridad de tu cuenta</a>{' '}
                      → "Generar contraseña de aplicación" → pégala aquí.
                    </>
                  )}
                  {smtpProvider === 'zoho' && (
                    <>
                      <strong>No uses tu contraseña normal</strong> — en Zoho ve a{' '}
                      <a href="https://accounts.zoho.com/home#security/app_passwords" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>Seguridad → Contraseñas de aplicación</a>{' '}
                      → crea una nueva y pégala aquí.
                    </>
                  )}
                  {smtpProvider === 'other' && (
                    <>
                      Para correo de dominio propio (por ejemplo, de un hosting), pídele a quien administra tu
                      correo el servidor y puerto de SMTP e IMAP — normalmente están en la documentación de tu
                      proveedor de hosting. Si tu correo pide verificación en dos pasos, también vas a necesitar
                      una contraseña de aplicación en vez de tu contraseña normal.
                    </>
                  )}
                </div>

                <input
                  type="email" required value={smtpEmail} onChange={e => setSmtpEmail(e.target.value)}
                  placeholder="tucorreo@empresa.com"
                  style={{
                    height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                    border: '1px solid var(--border-input)', padding: '0 14px', fontSize: '13px',
                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)',
                  }}
                />
                <input
                  type="password" required value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)}
                  placeholder="Contraseña de aplicación"
                  style={{
                    height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                    border: '1px solid var(--border-input)', padding: '0 14px', fontSize: '13px',
                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', letterSpacing: '.15em',
                  }}
                />

                {smtpProvider === 'other' && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px',
                    background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      Servidor de salida (SMTP)
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        required value={manualSmtpHost} onChange={e => setManualSmtpHost(e.target.value)}
                        placeholder="smtp.tuempresa.com"
                        style={{ flex: 2, height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-input)', padding: '0 10px', fontSize: '12.5px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)' }}
                      />
                      <input
                        required value={manualSmtpPort} onChange={e => setManualSmtpPort(e.target.value)}
                        placeholder="587" type="number"
                        style={{ flex: 1, height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-input)', padding: '0 10px', fontSize: '12.5px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)' }}
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={manualSmtpSecure} onChange={e => setManualSmtpSecure(e.target.checked)} />
                      Usa SSL/TLS directo (normalmente puerto 465 — déjalo sin marcar si usas 587)
                    </label>

                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: '6px' }}>
                      Servidor de entrada (IMAP)
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        required value={manualImapHost} onChange={e => setManualImapHost(e.target.value)}
                        placeholder="imap.tuempresa.com"
                        style={{ flex: 2, height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-input)', padding: '0 10px', fontSize: '12.5px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)' }}
                      />
                      <input
                        required value={manualImapPort} onChange={e => setManualImapPort(e.target.value)}
                        placeholder="993" type="number"
                        style={{ flex: 1, height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border-input)', padding: '0 10px', fontSize: '12.5px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)' }}
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={manualImapSecure} onChange={e => setManualImapSecure(e.target.checked)} />
                      Usa SSL/TLS (casi siempre sí, déjalo marcado)
                    </label>
                  </div>
                )}

                {smtpError && (
                  <div style={{
                    background: 'var(--alert-bg)', border: '1px solid var(--alert-text)', borderRadius: 'var(--radius-md)',
                    padding: '10px 14px', color: 'var(--alert-text)', fontSize: '12.5px',
                  }}>
                    {smtpError}
                  </div>
                )}

                <button type="submit" disabled={smtpSubmitting} style={{
                  alignSelf: 'flex-start', height: '40px', padding: '0 18px', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-primary)', border: 'none', color: '#FFFFFF', fontSize: '13px',
                  fontWeight: 700, cursor: smtpSubmitting ? 'default' : 'pointer', opacity: smtpSubmitting ? 0.7 : 1,
                  fontFamily: 'var(--font)',
                }}>
                  {smtpSubmitting ? 'Probando conexión…' : 'Conectar'}
                </button>
              </form>
            )}
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

      <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '24px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Términos y Condiciones de tus cotizaciones
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
          Un renglón por condición — cada uno aparece como un punto en el PDF de cotización. Si lo dejas
          vacío, FRIA usa un texto genérico por defecto.
        </div>

        {!termsLoaded ? (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
              value={termsInput}
              onChange={e => { setTermsInput(e.target.value); setTermsSaved(false); }}
              placeholder="Tarifas más IVA.&#10;Sujeto a pesos y dimensiones de la carga.&#10;..."
              rows={10}
              style={{
                width: '100%', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
                border: '1px solid var(--border-input)', padding: '14px', fontSize: '13px',
                color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)',
                lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box',
              }}
            />

            {termsError && (
              <div style={{
                background: 'var(--alert-bg)', border: '1px solid var(--alert-text)', borderRadius: 'var(--radius-md)',
                padding: '10px 14px', color: 'var(--alert-text)', fontSize: '12.5px',
              }}>
                {termsError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={handleSaveTerms} disabled={termsSaving} style={{
                height: '40px', padding: '0 20px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent-primary)', border: 'none', color: '#FFFFFF', fontSize: '13px',
                fontWeight: 700, cursor: termsSaving ? 'default' : 'pointer', opacity: termsSaving ? 0.7 : 1,
                fontFamily: 'var(--font)',
              }}>
                {termsSaving ? 'Guardando…' : 'Guardar'}
              </button>
              <button onClick={handleResetTerms} style={{
                height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', background: 'none',
                border: '1px solid var(--border-input)', color: 'var(--text-secondary)', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>
                Volver al texto de FRIA por defecto
              </button>
              {termsSaved && (
                <span style={{ fontSize: '12.5px', color: 'var(--success-text)' }}>Guardado.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
