import { Sparkles } from 'lucide-react';

// TEMPORAL — Jarvis/Chat se reconstruye conectado a Supabase (no Airtable).
// Pendiente en Sección 11.4 del business case: chat para admins de cada tenant,
// con acceso a sus propios datos (carriers por ruta, desempeño de vendedores,
// recomendaciones rápidas).

export default function ChatPage({ user }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', textAlign: 'center', padding: '24px'
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '14px',
        background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px'
      }}>
        <Sparkles size={24} style={{ color: 'var(--coral)' }} />
      </div>
      <h1 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
        FRIA Chat is coming soon
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '360px' }}>
        We're rebuilding the assistant on FRIA's own data layer. Soon you'll be able to ask about carriers by lane, team performance, and get quick recommendations right here.
      </p>
    </div>
  );
}
