import { LayoutGrid, List } from 'lucide-react';
import './Navbar.css';

export default function Navbar({
  search, onSearch,
  typeFilter, onTypeFilter,
  formatFilter, onFormatFilter,
  view, onViewChange,
}) {
  return (
    <nav className="navbar">
      <div className="navbar-title">Vault</div>

      <input
        className="navbar-search"
        type="text"
        placeholder="Search titles..."
        value={search}
        onChange={e => onSearch(e.target.value)}
      />

      {/* Mobile-only view toggle (next to search) */}
      <button
        className={`view-toggle mobile-only ${view === 'list' ? 'active' : ''}`}
        onClick={() => onViewChange(view === 'grid' ? 'list' : 'grid')}
        aria-label="Toggle view"
      >
        {view === 'grid' ? <List size={18} strokeWidth={1.8} /> : <LayoutGrid size={18} strokeWidth={1.8} />}
      </button>

      <div className="navbar-filters">
        {['all', 'movies', 'shows'].map(type => (
          <button
            key={type}
            className={`filter-chip ${typeFilter === type ? 'active' : ''}`}
            onClick={() => onTypeFilter(type)}
          >
            {type}
          </button>
        ))}

        <div className="filter-divider" />

        <button
          className={`filter-chip ${formatFilter === 'bluray' ? 'active-bluray' : ''}`}
          onClick={() => onFormatFilter(formatFilter === 'bluray' ? null : 'bluray')}
        >
          Blu-ray
        </button>

        <button
          className={`filter-chip ${formatFilter === 'vhs' ? 'active-vhs' : ''}`}
          onClick={() => onFormatFilter(formatFilter === 'vhs' ? null : 'vhs')}
        >
          VHS
        </button>

        <div className="filter-divider" />

        {/* Desktop-only view toggle (next to filters) */}
        <button
          className={`view-toggle desktop-only ${view === 'list' ? 'active' : ''}`}
          onClick={() => onViewChange(view === 'grid' ? 'list' : 'grid')}
          aria-label="Toggle view"
        >
          {view === 'grid' ? <List size={16} strokeWidth={1.8} /> : <LayoutGrid size={16} strokeWidth={1.8} />}
        </button>
      </div>
    </nav>
  );
}
