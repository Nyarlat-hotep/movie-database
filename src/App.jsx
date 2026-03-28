import { useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useLibrary } from './hooks/useLibrary.js';
import LoginOverlay from './components/Auth/LoginOverlay.jsx';
import Navbar from './components/Layout/Navbar.jsx';
import LibraryGrid from './components/Library/LibraryGrid.jsx';
import DetailModal from './components/Library/DetailModal.jsx';

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
      <DetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onEdit={(item) => console.log('edit', item.title)}
        onDelete={(item) => console.log('delete', item.title)}
      />
    </>
  );
}

export default App;
