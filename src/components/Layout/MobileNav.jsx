import { LogOut } from 'lucide-react';
import { MEDIA_TYPE_LIST } from '../../utils/mediaTypes.js';
import './MobileNav.css';

// Icon-only: four media types plus logout is the most that fits a 60px bar at
// 320px wide. Sub-filters live in the scrollable row under the top bar.
export default function MobileNav({ typeFilter, onTypeFilter, isSearching, onLogout }) {
  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-types">
        {MEDIA_TYPE_LIST.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`mobile-nav-item ${!isSearching && typeFilter === key ? 'active' : ''}`}
            onClick={() => onTypeFilter(key)}
            aria-label={label}
          >
            <Icon size={20} strokeWidth={1.8} />
          </button>
        ))}
      </div>

      <div className="mobile-nav-divider" />

      <button className="mobile-nav-logout" onClick={onLogout} aria-label="Logout">
        <LogOut size={17} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
