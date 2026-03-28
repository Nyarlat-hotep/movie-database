import { LogOut, Film, Tv, LayoutGrid, Disc3, CassetteTape } from 'lucide-react';
import './MobileNav.css';

export default function MobileNav({
  typeFilter, onTypeFilter,
  formatFilter, onFormatFilter,
  onLogout,
}) {
  const typeItems = [
    { key: 'all',    label: 'All',    Icon: LayoutGrid },
    { key: 'movies', label: 'Movies', Icon: Film       },
    { key: 'shows',  label: 'Shows',  Icon: Tv         },
  ];

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-types">
        {typeItems.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`mobile-nav-item ${typeFilter === key ? 'active' : ''}`}
            onClick={() => onTypeFilter(key)}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="mobile-nav-divider" />

      <div className="mobile-nav-formats">
        <button
          className={`mobile-nav-format ${formatFilter === 'bluray' ? 'active-bluray' : ''}`}
          onClick={() => onFormatFilter(formatFilter === 'bluray' ? null : 'bluray')}
        >
          <Disc3 size={16} strokeWidth={1.8} />
          <span>BR</span>
        </button>
        <button
          className={`mobile-nav-format ${formatFilter === 'vhs' ? 'active-vhs' : ''}`}
          onClick={() => onFormatFilter(formatFilter === 'vhs' ? null : 'vhs')}
        >
          <CassetteTape size={16} strokeWidth={1.8} />
          <span>VHS</span>
        </button>
      </div>

      <div className="mobile-nav-divider" />

      <button className="mobile-nav-logout" onClick={onLogout} aria-label="Logout">
        <LogOut size={17} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
