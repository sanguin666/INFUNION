import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getSuperadminSession, setSuperadminSession } from '../api/client';
import { LogoMark } from '../components/LogoMark';
import { AppearancePicker } from '../components/AppearancePicker';
import { SuperadminGate } from './SuperadminGate';

const NAV = [
  { to: 'overview', label: "Vue d'ensemble" },
  { to: 'communities', label: 'Communautés' },
  { to: 'accounts', label: 'Utilisateurs' },
  { to: 'health', label: 'Santé technique' },
  { to: 'journal', label: 'Journal' },
];

function SessionClock() {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const session = getSuperadminSession();
  if (!session) return null;
  const minutes = Math.max(0, Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 60000));
  return <p className="sidebar-user">Session : encore {minutes} min</p>;
}

/** ANSAE's own section (Seb, 17 Oct 2026), behind the code gate. */
export function SuperadminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  if (!user.isSuperadmin) return <Navigate to="/" replace />;

  function lock() {
    setSuperadminSession(null);
    navigate('/', { replace: true });
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <LogoMark size={30} />
            <h1>ANSAE Admin</h1>
          </div>
          <p className="sidebar-user">{user.email}</p>
        </div>

        <hr className="menu-divider" />
        <p className="poi-switcher-caption">Superadmin</p>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user.adminPois.length > 0 && (
          <>
            <hr className="menu-divider" />
            <nav>
              <Link to="/">Mes communautés</Link>
            </nav>
          </>
        )}

        <div className="sidebar-footer">
          <hr className="menu-divider" />
          <SessionClock />
          <AppearancePicker />
          <button type="button" className="btn btn-block" onClick={lock}>
            Verrouiller
          </button>
          <button type="button" className="btn btn-destructive btn-block" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="main">
        <SuperadminGate>
          <Outlet />
        </SuperadminGate>
      </main>
    </div>
  );
}
