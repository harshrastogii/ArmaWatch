import { Link, useLocation } from "react-router-dom";

const ACCENT = "#d61f9a";

export default function AppHeader() {
  const { pathname } = useLocation();
  const onMap = pathname === "/";
  return (
    <header className="wp-appbar">
      <Link to="/" className="wp-wordmark" aria-label="ArmaWatch home">
        <svg className="wp-logo" viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke={ACCENT} strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.2" stroke="#f5f5f4" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="1" fill={ACCENT} />
          <line x1="12" y1="1.5" x2="12" y2="6" stroke="#f5f5f4" strokeWidth="1.6" />
          <line x1="12" y1="18" x2="12" y2="22.5" stroke="#f5f5f4" strokeWidth="1.6" />
          <line x1="1.5" y1="12" x2="6" y2="12" stroke="#f5f5f4" strokeWidth="1.6" />
          <line x1="18" y1="12" x2="22.5" y2="12" stroke="#f5f5f4" strokeWidth="1.6" />
        </svg>
        <span>ARMA<span style={{ color: ACCENT }}>WATCH</span></span>
      </Link>
      <nav className="flex gap-2">
        <Link to="/" className={`wp-chip wp-chip-dark ${onMap ? "wp-chip-on" : ""}`}>Map</Link>
        <Link to="/dashboard" className={`wp-chip wp-chip-dark ${!onMap ? "wp-chip-on" : ""}`}>Analytics</Link>
      </nav>
    </header>
  );
}
