import { useState } from 'react';
import { useSite } from '../SiteContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Demo() {
  const { t, lang } = useSite();
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', route: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [fieldErrors, setFieldErrors] = useState({});
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = true;
    if (!form.company.trim()) errs.company = true;
    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) errs.email = true;
    if (!form.route.trim()) errs.route = true;
    if (!privacyAccepted) errs.privacy = true;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lang }),
      });
      if (!res.ok) throw new Error('bad status');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  const inputStyle = (hasError) => ({
    width: '100%', height: 46, padding: '0 14px', borderRadius: 8, background: 'var(--cardsub)',
    border: `1px solid ${hasError ? 'var(--coral)' : 'var(--border2)'}`, color: 'var(--txt)',
    fontSize: 14, fontFamily: "'Inter',Arial,sans-serif", outline: 'none', boxSizing: 'border-box',
  });

  return (
    <div style={{ borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(800px 400px at 70% 0%, var(--glow), transparent 70%)' }} />
      <div style={{
        position: 'relative', maxWidth: 1200, margin: '0 auto', padding: 'var(--page-pad)',
        display: 'grid', gridTemplateColumns: 'var(--demo-grid)', gap: 56, alignItems: 'start',
      }}>
        <div>
          <div style={{ fontSize: 'var(--page-h1-fs)', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-.02em', textWrap: 'pretty' }}>{t.s6title}</div>
          <div style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--txt2)', marginTop: 18, textWrap: 'pretty' }}>{t.s6p}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            {[t.dm1, t.dm2, t.dm3].map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--txt)' }}>
                <span style={{ color: 'var(--accent)' }}>●</span> {d}
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--txt3)', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            adolfo.romero@friaai.com
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 30px', boxShadow: 'var(--shadow)' }}>
          {status === 'success' ? (
            <div style={{ padding: '30px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--okbd)' }}>{t.fSuccess}</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'var(--form-grid)', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt3)', marginBottom: 7 }}>{t.fName}</div>
                  <input value={form.name} onChange={update('name')} placeholder={t.phName} style={inputStyle(fieldErrors.name)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt3)', marginBottom: 7 }}>{t.fCompany}</div>
                  <input value={form.company} onChange={update('company')} placeholder={t.phCompany} style={inputStyle(fieldErrors.company)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt3)', marginBottom: 7 }}>{t.fEmail}</div>
                  <input value={form.email} onChange={update('email')} placeholder={t.phEmail} type="email" style={inputStyle(fieldErrors.email)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt3)', marginBottom: 7 }}>{t.fPhone}</div>
                  <input value={form.phone} onChange={update('phone')} placeholder={t.phPhone} style={inputStyle(false)} />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt3)', marginBottom: 7 }}>{t.fRoute}</div>
                <input value={form.route} onChange={update('route')} placeholder={t.phRoute} style={inputStyle(fieldErrors.route)} />
              </div>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={e => { setPrivacyAccepted(e.target.checked); setFieldErrors(fe => ({ ...fe, privacy: false })); }}
                  style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: fieldErrors.privacy ? 'var(--coral)' : 'var(--txt3)' }}>
                  {t.fPrivacyLabel}
                  <a href="/aviso-de-privacidad" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    {t.fPrivacyLink}
                  </a>.
                </span>
              </label>
              {fieldErrors.privacy && (
                <div style={{ fontSize: 11.5, color: 'var(--coral)', marginTop: 5 }}>{t.fPrivacyError}</div>
              )}

              <button
                onClick={handleSubmit}
                disabled={status === 'loading'}
                style={{
                  marginTop: 16, width: '100%', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 9, background: 'var(--btnbg)', color: 'var(--btntxt)', fontSize: 15, fontWeight: 700,
                  cursor: status === 'loading' ? 'default' : 'pointer', border: 'none',
                  fontFamily: "'Inter',Arial,sans-serif", opacity: status === 'loading' ? 0.7 : 1,
                }}
              >
                {status === 'loading' ? '…' : t.fSubmit}
              </button>
              {status === 'error' && (
                <div style={{ fontSize: 12.5, color: 'var(--coral)', marginTop: 12, textAlign: 'center' }}>{t.fError}</div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--txt4)', marginTop: 12, textAlign: 'center' }}>{t.fNote}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
