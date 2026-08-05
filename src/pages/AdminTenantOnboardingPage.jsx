import { useState } from 'react';
import { supabase } from '../supabaseClient';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'sales', label: 'Ventas' },
  { value: 'readonly', label: 'Solo lectura' },
];

const PLANS = [
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

function emptyUser() {
  return { email: '', firstName: '', lastName: '', role: 'sales' };
}

const inputStyle = {
  height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)',
  border: '1px solid var(--border-input)', padding: '0 12px', fontSize: '13px',
  color: 'var(--text-primary)', fontFamily: 'var(--font)', boxSizing: 'border-box', width: '100%',
};
const labelStyle = { fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' };

export default function AdminTenantOnboardingPage() {
  const [companyName, setCompanyName] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [country, setCountry] = useState('MX');
  const [plan, setPlan] = useState('starter');
  const [users, setUsers] = useState([emptyUser()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function updateUser(i, field, value) {
    setUsers(prev => prev.map((u, idx) => idx === i ? { ...u, [field]: value } : u));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSubmitting(false); return; }

    try {
      const res = await fetch('/api/admin/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ companyName, primaryEmail, country, plan, users }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Algo falló al crear el tenant.');
      } else {
        setResult(data);
        setCompanyName(''); setPrimaryEmail(''); setUsers([emptyUser()]);
      }
    } catch (e) {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: '48px 56px', maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Dar de alta un tenant nuevo</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Solo visible para staff de FRIA. Crea el tenant e invita a sus primeros usuarios de una vez.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Datos del tenant</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={labelStyle}>Nombre de la empresa</div>
              <input required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Grupo Industrial XYZ" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Correo principal</div>
              <input required type="email" value={primaryEmail} onChange={e => setPrimaryEmail(e.target.value)} placeholder="contacto@cliente.com" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={labelStyle}>País</div>
              <select value={country} onChange={e => setCountry(e.target.value)} style={inputStyle}>
                <option value="MX">México</option>
                <option value="US">Estados Unidos</option>
                <option value="CA">Canadá</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>Plan</div>
              <select value={plan} onChange={e => setPlan(e.target.value)} style={inputStyle}>
                {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Usuarios iniciales</div>
            <button type="button" onClick={() => setUsers(prev => [...prev, emptyUser()])} style={{
              height: '32px', padding: '0 12px', borderRadius: 'var(--radius-sm)', background: 'none',
              border: '1px solid var(--border-input)', color: 'var(--accent-primary)', fontSize: '12px',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
            }}>
              + Agregar usuario
            </button>
          </div>

          {users.map((u, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr auto', gap: '10px', alignItems: 'end',
              paddingBottom: '14px', borderBottom: i < users.length - 1 ? '1px solid var(--border-card)' : 'none',
            }}>
              <div>
                {i === 0 && <div style={labelStyle}>Correo</div>}
                <input required type="email" value={u.email} onChange={e => updateUser(i, 'email', e.target.value)} placeholder="persona@cliente.com" style={inputStyle} />
              </div>
              <div>
                {i === 0 && <div style={labelStyle}>Nombre</div>}
                <input required value={u.firstName} onChange={e => updateUser(i, 'firstName', e.target.value)} style={inputStyle} />
              </div>
              <div>
                {i === 0 && <div style={labelStyle}>Apellido</div>}
                <input required value={u.lastName} onChange={e => updateUser(i, 'lastName', e.target.value)} style={inputStyle} />
              </div>
              <div>
                {i === 0 && <div style={labelStyle}>Rol</div>}
                <select value={u.role} onChange={e => updateUser(i, 'role', e.target.value)} style={inputStyle}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setUsers(prev => prev.filter((_, idx) => idx !== i))}
                disabled={users.length === 1}
                style={{
                  height: '42px', width: '36px', borderRadius: 'var(--radius-sm)', background: 'none',
                  border: '1px solid var(--border-input)', color: 'var(--alert-text)', cursor: users.length === 1 ? 'not-allowed' : 'pointer',
                  opacity: users.length === 1 ? 0.4 : 1, fontFamily: 'var(--font)',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'var(--alert-bg)', color: 'var(--alert-text)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} style={{
          height: '46px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)', color: '#FFFFFF',
          border: 'none', fontSize: '14px', fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.7 : 1, fontFamily: 'var(--font)',
        }}>
          {submitting ? 'Creando…' : 'Crear tenant e invitar usuarios'}
        </button>
      </form>

      {result && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Tenant creado: {result.tenant.company_name} ({result.tenant.slug})
          </div>
          {result.results.map((r, i) => (
            <div key={i} style={{ fontSize: '13px', color: r.success ? 'var(--success-text)' : 'var(--alert-text)' }}>
              {r.success ? '✓' : '✗'} {r.email} {!r.success && `— ${r.step}: ${r.error || 'error desconocido'}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
