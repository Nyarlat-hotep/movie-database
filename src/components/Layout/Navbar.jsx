import './Navbar.css';

export default function Navbar({
  search, onSearch,
  typeFilter, onTypeFilter,
  formatFilter, onFormatFilter,
  onLogout,
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
      </div>

      <button className="navbar-logout" onClick={onLogout}>Logout</button>
    </nav>
  );
}
