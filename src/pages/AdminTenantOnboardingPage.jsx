import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const PLANS = ['starter', 'growth', 'pro', 'enterprise'];

const PLAN_BADGE = {
  starter: { bg: '#EEF1F8', color: 'var(--text-secondary)' },
  growth: { bg: 'var(--info-bg)', color: 'var(--info-text)' },
  pro: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  enterprise: { bg: '#F3E8FF', color: '#7C3AED' },
};

const STATUS_BADGE = {
  trial: { bg: '#FFF4E5', color: '#B36B00' },
  active: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  cancelled: { bg: 'var(--alert-bg)', color: 'var(--alert-text)' },
};

const ROLE_LABELS = { admin: 'Admin', pricing: 'Pricing', sales: 'Ventas', readonly: 'Solo lectura' };

function timeAgo(iso) {
  if (!iso) return '—';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  async function loadTenants() {
    setLoading(true);
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    try {
      const res = await fetch('/api/admin/tenants', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo cargar.');
      } else {
        setTenants(data.tenants);
      }
    } catch {
      setError('No se pudo conectar con FRIA.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTenants(); }, []);

  async function updateTenant(tenantId, updates) {
    setSavingId(tenantId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSavingId(null); return; }

    try {
      await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tenantId, ...updates }),
      });
      // Actualiza en memoria de inmediato -- no hace falta recargar todo.
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, ...(updates.plan !== undefined ? { plan: updates.plan } : {}), ...(updates.miPlan !== undefined ? { mi_plan: updates.miPlan } : {}) } : t));
    } finally {
      setSavingId(null);
    }
  }

  const filtered = tenants.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.company_name?.toLowerCase().includes(s)
      || t.users.some(u => u.email?.toLowerCase().includes(s));
  });

  return (
    <div style={{ padding: '48px var(--page-pad-x)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>Tenants</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Solo visible para staff de FRIA. Plan, acceso a Inteligencia de Mercado, y usuarios de cada tenant.
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Buscar por empresa o correo..."
        style={{
          height: '44px', maxWidth: '420px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)', border: '1px solid var(--border-input)',
          padding: '0 16px', fontSize: '13px', color: 'var(--text-primary)',
          outline: 'none', fontFamily: 'var(--font)',
        }}
      />

      {error && (
        <div style={{ background: 'var(--alert-bg)', color: 'var(--alert-text)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
          padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          {search ? 'Sin resultados para esa búsqueda.' : 'Todavía no hay tenants.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(t => {
            const planBadge = PLAN_BADGE[t.plan] || PLAN_BADGE.starter;
            const statusBadge = STATUS_BADGE[t.status] || STATUS_BADGE.trial;
            const hasMi = t.mi_plan && t.mi_plan !== 'none';
            const isExpanded = expandedId === t.id;
            const isSaving = savingId === t.id;

            return (
              <div key={t.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)',
              }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  style={{
                    padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: '12px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t.company_name}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {t.slug} · {t.users.length} usuario{t.users.length === 1 ? '' : 's'} · creado {timeAgo(t.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: statusBadge.bg, color: statusBadge.color }}>
                      {t.status}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: planBadge.bg, color: planBadge.color }}>
                      {t.plan}
                    </span>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                      background: hasMi ? 'var(--success-bg)' : '#EEF1F8', color: hasMi ? 'var(--success-text)' : 'var(--text-secondary)',
                    }}>
                      {hasMi ? 'Con Inteligencia de Mercado' : 'Sin Inteligencia de Mercado'}
                    </span>
                    <span style={{ color: 'var(--accent-primary)', fontSize: '14px' }}>{isExpanded ? '▾' : '▸'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 22px 20px', display: 'flex', flexDirection: 'column', gap: '18px', borderTop: '1px solid var(--border-card)' }}>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', paddingTop: '16px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Plan</div>
                        <select
                          value={t.plan}
                          disabled={isSaving}
                          onChange={e => updateTenant(t.id, { plan: e.target.value })}
                          style={{
                            height: '36px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-panel)',
                            border: '1px solid var(--border-input)', padding: '0 10px', fontSize: '12.5px',
                            color: 'var(--text-primary)', fontFamily: 'var(--font)',
                          }}
                        >
                          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Inteligencia de Mercado</div>
                        <select
                          value={hasMi ? 'active' : 'none'}
                          disabled={isSaving}
                          onChange={e => updateTenant(t.id, { miPlan: e.target.value === 'active' ? 'active' : 'none' })}
                          style={{
                            height: '36px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-panel)',
                            border: '1px solid var(--border-input)', padding: '0 10px', fontSize: '12.5px',
                            color: 'var(--text-primary)', fontFamily: 'var(--font)',
                          }}
                        >
                          <option value="none">Sin acceso</option>
                          <option value="active">Con acceso</option>
                        </select>
                      </div>
                      {isSaving && <div style={{ alignSelf: 'flex-end', fontSize: '11.5px', color: 'var(--text-secondary)' }}>Guardando…</div>}
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Usuarios
                      </div>
                      {t.users.length === 0 ? (
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Sin usuarios todavía.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {t.users.map((u, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12.5px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.first_name} {u.last_name}</span>
                              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>{u.email}</span>
                              <span style={{
                                padding: '2px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 600,
                                background: '#EEF1F8', color: 'var(--text-secondary)',
                              }}>
                                {ROLE_LABELS[u.role] || u.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
