import { useState } from 'react';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import './Navbar.css';

export default function Navbar({
  search, onSearch,
  typeFilter, onTypeFilter,
  formatFilter, onFormatFilter,
  view, onViewChange,
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearchToggle = () => {
    setSearchOpen(!searchOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-title">Vault</div>

      <div className="navbar-right">
        {/* Mobile search bar (expands from icon) */}
        <div className="navbar-search-wrap mobile-only">
          <input
            className={`navbar-search ${searchOpen ? 'open' : ''}`}
            type="text"
            placeholder="Search titles..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            autoFocus={searchOpen}
          />
          <button
            className={`navbar-search-icon ${searchOpen ? 'open' : ''}`}
            onClick={handleSearchToggle}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
          >
            {searchOpen ? <X size={18} strokeWidth={2} /> : <Search size={18} strokeWidth={2} />}
          </button>
        </div>

        {/* Desktop search bar (always visible) */}
        <input
          className="navbar-search desktop-only"
          type="text"
          placeholder="Search titles..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />

        {/* Mobile-only view toggle */}
        <div className="view-toggle-wrap mobile-only">
          <div className={`view-pill ${view === 'list' ? 'right' : ''}`} />
          <button className={`view-opt ${view === 'grid' ? 'active' : ''}`} onClick={() => onViewChange('grid')} aria-label="Grid view" data-tooltip="Grid">
            <LayoutGrid size={15} strokeWidth={1.8} />
          </button>
          <button className={`view-opt ${view === 'list' ? 'active' : ''}`} onClick={() => onViewChange('list')} aria-label="List view" data-tooltip="List">
            <List size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="navbar-filters">
        {['All', 'Movies', 'Shows'].map(type => (
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
        <div className="view-toggle-wrap desktop-only">
          <div className={`view-pill ${view === 'list' ? 'right' : ''}`} />
          <button className={`view-opt ${view === 'grid' ? 'active' : ''}`} onClick={() => onViewChange('grid')} aria-label="Grid view" data-tooltip="Grid">
            <LayoutGrid size={14} strokeWidth={1.8} />
          </button>
          <button className={`view-opt ${view === 'list' ? 'active' : ''}`} onClick={() => onViewChange('list')} aria-label="List view" data-tooltip="List">
            <List size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </nav>
  );
}
