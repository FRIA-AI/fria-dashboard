import { BarChart2, Users, Route, TrendingUp, Inbox } from 'lucide-react';
import { getMetrics } from '../store';

export default function MetricsPage({ user }) {
  const metrics = getMetrics();

  const colors = ['var(--coral)', '#1B2A4A', '#3b82f6', '#16a34a', '#d97706', '#7c3aed'];

  const maxUserCount = Math.max(...metrics.byUser.map(u => u.count), 1);
  const maxLaneCount = Math.max(...metrics.byLane.map(l => l.count), 1);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>Team Metrics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Quote activity across the commercial team</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <StatCard icon={<TrendingUp size={18} />} label="Total Quotes" value={metrics.total} />
        <StatCard icon={<Users size={18} />} label="Active Sellers" value={metrics.byUser.length} />
        <StatCard icon={<Route size={18} />} label="Unique Lanes" value={metrics.byLane.length} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', padding: '22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Users size={16} style={{ color: 'var(--coral)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Quotes by Seller</h2>
          </div>

          {metrics.byUser.length === 0 ? (
            <EmptyState label="No data yet" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {metrics.byUser.map((u, i) => (
                <div key={u.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {u.name.split(' ')[0]}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        {u.lanes} lane{u.lanes !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: colors[i % colors.length] }}>
                      {u.count}
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px',
                      background: colors[i % colors.length],
                      width: `${Math.round((u.count / maxUserCount) * 100)}%`,
                      transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', padding: '22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Route size={16} style={{ color: 'var(--coral)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Top Lanes</h2>
          </div>

          {metrics.byLane.length === 0 ? (
            <EmptyState label="No lanes detected yet" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {metrics.byLane.slice(0, 8).map((l, i) => (
                <div key={l.lane}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                      <span style={{
                        fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)',
                        display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {l.lane}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {l.users} seller{l.users !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--navy)', flexShrink: 0 }}>
                      {l.count}
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px', background: 'var(--navy)',
                      width: `${Math.round((l.count / maxLaneCount) * 100)}%`,
                      transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {metrics.byUser.some(u => u.name === user.name) && (
        <div style={{
          marginTop: '18px', background: 'rgba(27,42,74,0.04)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '18px 22px'
        }}>
          <p style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Your activity
          </p>
          {(() => {
            const me = metrics.byUser.find(u => u.name === user.name);
            return me ? (
              <div style={{ display: 'flex', gap: '28px' }}>
                <div>
                  <p style={{ fontSize: '26px', fontWeight: '600', color: 'var(--coral)' }}>{me.count}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>quotes submitted</p>
                </div>
                <div>
                  <p style={{ fontSize: '26px', fontWeight: '600', color: 'var(--navy)' }}>{me.lanes}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>unique lanes</p>
                </div>
                <div>
                  <p style={{ fontSize: '26px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    #{metrics.byUser.findIndex(u => u.name === user.name) + 1}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>team ranking</p>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)', padding: '18px 20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--coral)' }}>
        {icon}
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <p style={{ fontSize: '32px', fontWeight: '600', color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ padding: '30px 0', textAlign: 'center' }}>
      <Inbox size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Submit quotes to start tracking metrics</p>
    </div>
  );
}
