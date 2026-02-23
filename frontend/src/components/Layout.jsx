import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/customers', label: 'Customers', icon: '👥' },
  { path: '/plans', label: 'Plans', icon: '📋' },
  { path: '/trips', label: 'Trips', icon: '🚌' },
  { path: '/kiosk', label: 'Kiosk Mode', icon: '🖥️', external: true },
  { path: '/payments', label: 'Payments', icon: '💳' },
  { path: '/reports', label: 'Reports', icon: '📈' },
  { path: '/tracking', label: 'Tracking', icon: '📍' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('shuttle_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setAdmin(payload);
      }
    } catch {}
  }, []);

  function handleLogout() {
    localStorage.removeItem('shuttle_token');
    navigate('/login');
  }

  const pageTitle = NAV_ITEMS.find((n) => location.pathname.startsWith(n.path))?.label || 'Shuttle';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          🚌 <span>Shuttle</span> Admin
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) =>
            item.external ? (
              <a
                key={item.path}
                href={item.path}
                target="_blank"
                rel="noreferrer"
                className="nav-item"
                style={{ textDecoration: 'none' }}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </a>
            ) : (
              <div
                key={item.path}
                className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </div>
            )
          )}
        </nav>
      </aside>
      <div className="main-content">
        <div className="topbar">
          <div className="topbar-title">{pageTitle}</div>
          <div className="topbar-user">
            <span>{admin?.name || 'Admin'}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
