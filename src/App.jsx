import { useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useLibrary } from './hooks/useLibrary.js';
import LoginOverlay from './components/Auth/LoginOverlay.jsx';
import Navbar from './components/Layout/Navbar.jsx';
import LibraryGrid from './components/Library/LibraryGrid.jsx';

function App() {
  const { user, loading, login, logout } = useAuth();
  const {
    filtered, search, setSearch,
    typeFilter, setTypeFilter,
    formatFilter, setFormatFilter,
  } = useLibrary();
  const [selected, setSelected] = useState(null);

  if (loading) return null;
  if (!user) return <LoginOverlay onLogin={login} />;

  return (
    <>
      <Navbar
        search={search} onSearch={setSearch}
        typeFilter={typeFilter} onTypeFilter={setTypeFilter}
        formatFilter={formatFilter} onFormatFilter={setFormatFilter}
        onLogout={logout}
      />
      <main style={{ paddingTop: '64px' }}>
        <LibraryGrid items={filtered} onSelect={setSelected} />
      </main>
      {selected && (
        <div style={{ color: '#ff7700', position: 'fixed', bottom: 10, left: 10, fontFamily: 'monospace', fontSize: '0.75rem', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: 4 }}>
          Selected: {selected.title}
        </div>
      )}
    </>
  );
}

export default App;
