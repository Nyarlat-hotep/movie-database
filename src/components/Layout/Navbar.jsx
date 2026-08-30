import { useState } from 'react';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import { MEDIA_TYPE_LIST, facetLabel, facetColor } from '../../utils/mediaTypes.js';
import './Navbar.css';

export default function Navbar({
  search, onSearch, isSearching,
  typeFilter, onTypeFilter,
  facetFilter, onFacetFilter, facetOptions,
  view, onViewChange,
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearchToggle = () => {
    setSearchOpen(!searchOpen);
  };

  const facetChips = facetOptions.map(facet => (
    <button
      key={facet}
      className={`filter-chip filter-chip--facet ${facetFilter === facet ? 'active-facet' : ''}`}
      style={{ '--facet-color': facetColor(facet) }}
      onClick={() => onFacetFilter(facetFilter === facet ? null : facet)}
    >
      {facetLabel(facet)}
    </button>
  ));

  return (
    <nav className="navbar">
      <div className="navbar-title">Vault</div>

      <div className="navbar-right">
        {/* Mobile search bar (expands from icon) */}
        <div className="navbar-search-wrap mobile-only">
          <input
            className={`navbar-search ${searchOpen ? 'open' : ''}`}
            type="text"
            placeholder="Search all media..."
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
          placeholder="Search all media..."
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

      {/* Search spans every media type, so the tab selection goes inactive
          while a query is present. */}
      <div className={`navbar-filters ${isSearching ? 'searching' : ''}`}>
        {MEDIA_TYPE_LIST.map(type => (
          <button
            key={type.key}
            className={`filter-chip ${!isSearching && typeFilter === type.key ? 'active' : ''}`}
            onClick={() => onTypeFilter(type.key)}
          >
            {type.label}
          </button>
        ))}

        {facetChips.length > 0 && <div className="filter-divider" />}
        {facetChips}

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

      {/* Mobile sub-filters: scrollable row under the bar, since the bottom nav
          only has room for the four type icons. */}
      {!isSearching && facetChips.length > 0 && (
        <div className="navbar-facets-mobile mobile-only">{facetChips}</div>
      )}
    </nav>
  );
}
