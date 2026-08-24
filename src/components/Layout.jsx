import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSite } from '../SiteContext';
import Logo from './Logo';

const NAV_ITEMS = [
  { path: '/que-es', key: 'navQue' },
  { path: '/como-funciona', key: 'navComo' },
  { path: '/metricas', key: 'navMet' },
  { path: '/inteligencia-de-mercado', key: 'navIntel' },
  { path: '/demo', key: 'navDemo' },
];

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: 13.5, whiteSpace: 'nowrap', fontWeight: active ? 700 : 500,
        cursor: 'pointer', padding: '23px 0',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        color: active ? 'var(--accent)' : 'var(--txt2)', textDecoration: 'none',
        outlineOffset: 3,
      }}
    >
      {children}
    </Link>
  );
}

function Nav() {
  const { t, lang, setLang, theme, setTheme } = useSite();
  const location = useLocation();
  const navigate = useNavigate();

  const segBtn = (active) => ({
    padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'JetBrains Mono',monospace", border: 'none',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--btntxt)' : 'var(--txt2)',
  });

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50, background: 'var(--navbg)',
      backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: 'var(--content-pad)', height: 68,
        display: 'flex', alignItems: 'center', gap: 28,
      }}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', flexShrink: 0 }}>
          <Logo />
        </div>

        <div
          id="fria-nav-scroll"
          style={{
            flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 20,
            overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
          }}
        >
          {NAV_ITEMS.map(item => (
            <NavLink key={item.path} to={item.path} active={location.pathname === item.path}>
              {t[item.key]}
            </NavLink>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 7, overflow: 'hidden' }}>
              <button className="nav-lang-btn" onClick={() => setLang('es')} style={segBtn(lang === 'es')}>ES</button>
              <button className="nav-lang-btn" onClick={() => setLang('en')} style={segBtn(lang === 'en')}>EN</button>
            </div>
            <button
              className="nav-theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                height: 30, padding: '0 11px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border2)', borderRadius: 7, cursor: 'pointer', background: 'transparent',
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 500, color: 'var(--txt2)',
                whiteSpace: 'nowrap',
              }}
            >
              {theme === 'dark' ? (lang === 'es' ? 'Claro' : 'Light') : (lang === 'es' ? 'Oscuro' : 'Dark')}
            </button>
          </div>

          
            className="nav-cta"
            href={import.meta.env.VITE_APP_URL || 'https://www.friaai.com'}
            style={{
              display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 20px',
              borderRadius: 8, background: 'var(--btnbg)', color: 'var(--btntxt)',
              fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, textDecoration: 'none',
            }}
          >
            {t.cta}
          </a>
        </div>
      </div>
    </div>
  );
}

function ClosingCta() {
  const { t } = useSite();
  const navigate = useNavigate();
  return (
    <div style={{ borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(700px 320px at 50% 120%, var(--glow), transparent 70%)',
      }} />
      <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '80px var(--content-pad-x)', textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-.025em', textWrap: 'pretty' }}>
          {t.ctaTitle}
        </div>
        <div style={{ fontSize: 16, color: 'var(--txt2)', marginTop: 18 }}>{t.ctaSub}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
          
            href={import.meta.env.VITE_APP_URL || 'https://www.friaai.com'}
            style={{
              display: 'inline-flex', alignItems: 'center', height: 52, padding: '0 32px',
              borderRadius: 9, background: 'var(--btnbg)', color: 'var(--btntxt)',
              fontSize: 15.5, fontWeight: 700, textDecoration: 'none',
            }}
          >
            {t.ctaArrow}
          </a>
          <button
            onClick={() => navigate('/demo')}
            style={{
              display: 'inline-flex', alignItems: 'center', height: 52, padding: '0 28px',
              borderRadius: 9, border: '1px solid var(--border2)', color: 'var(--txt)',
              fontSize: 15.5, fontWeight: 600, cursor: 'pointer', background: 'transparent',
              fontFamily: "'Inter',Arial,sans-serif",
            }}
          >
            {t.navDemo}
          </button>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const navigate = useNavigate();
  const { t } = useSite();
  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: '36px var(--content-pad-x) 48px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    }}>
      <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <Logo height={16} gap={2} barWidth={4} showWordmark={false} />
        <div style={{ fontSize: 13, color: 'var(--txt3)' }}>FRIA · Freight Rate Intelligence</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div onClick={() => navigate('/aviso-de-privacidad')} style={{ fontSize: 13, color: 'var(--txt3)', cursor: 'pointer' }}>
          {t.footerPrivacy}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: 'var(--txt4)' }}>© 2026 FRIA</div>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <div style={{
      background: 'var(--bg)', fontFamily: "'Inter',Arial,sans-serif", color: 'var(--txt)',
      minHeight: '100vh', overflowX: 'hidden',
    }}>
      <Nav />
      {children}
      <ClosingCta />
      <Footer />
    </div>
  );
}
