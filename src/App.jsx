import { useState } from 'react';
import { Plus, LogOut, Shuffle } from 'lucide-react';
import { useAuth } from './hooks/useAuth.js';
import { useLibrary } from './hooks/useLibrary.js';
import LoginOverlay from './components/Auth/LoginOverlay.jsx';
import Navbar from './components/Layout/Navbar.jsx';
import MobileNav from './components/Layout/MobileNav.jsx';
import LibraryGrid from './components/Library/LibraryGrid.jsx';
import ListView from './components/Library/ListView.jsx';
import DetailModal from './components/Library/DetailModal.jsx';
import AddEditModal from './components/Admin/AddEditModal.jsx';
import ConfirmDelete from './components/Admin/ConfirmDelete.jsx';
import './App.css';

function App() {
  const { user, loading, login, logout } = useAuth();
  const {
    filtered, search, setSearch, isSearching,
    typeFilter, setTypeFilter,
    facetFilter, setFacetFilter, facetOptions,
    addItem, editItem, removeItem,
    saving,
  } = useLibrary();

  const [selected, setSelected]   = useState(null);  // item shown in DetailModal
  const [editing, setEditing]     = useState(null);  // item or 'new'
  const [deleting, setDeleting]   = useState(null);  // item pending delete
  const [view, setView]           = useState('grid'); // 'grid' | 'list'
  const [error, setError]         = useState(null);  // save/delete failure message

  if (loading) return null;
  if (!user) return <LoginOverlay onLogin={login} />;

  // Supabase rejections used to surface only as an unhandled promise rejection
  // in the console — the modal just sat there with no explanation.
  const handleSave = async (item) => {
    try {
      if (editing === 'new') await addItem(item);
      else await editItem(item);
      setEditing(null);
      setSelected(null);
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
    }
  };

  const handleDelete = async (item) => {
    try {
      await removeItem(item);
      setDeleting(null);
      setSelected(null);
    } catch (err) {
      setDeleting(null);
      setError(err.message || 'Could not remove. Please try again.');
    }
  };

  return (
    <>
      <Navbar
        search={search}         onSearch={setSearch}   isSearching={isSearching}
        typeFilter={typeFilter} onTypeFilter={setTypeFilter}
        facetFilter={facetFilter} onFacetFilter={setFacetFilter} facetOptions={facetOptions}
        view={view} onViewChange={setView}
      />

      {/* Floating logout button */}
      <button onClick={logout} aria-label="Logout" className="fab-logout">
        <LogOut size={16} strokeWidth={2} />
      </button>

      <main
        style={{ paddingTop: '64px', paddingBottom: '0' }}
        className={`main-content ${isSearching || facetOptions.length === 0 ? 'main-content--no-facets' : ''}`}
      >
        {view === 'grid'
          ? <LibraryGrid items={filtered} onSelect={setSelected} uniform={isSearching} />
          : <ListView items={filtered} onSelect={setSelected} />
        }
      </main>

      {/* Floating random button */}
      <button
        onClick={() => {
          if (filtered.length === 0) return;
          setSelected(filtered[Math.floor(Math.random() * filtered.length)]);
        }}
        aria-label="Random title"
        className="fab-random"
      >
        <Shuffle size={22} strokeWidth={2} />
      </button>

      {/* Floating add button */}
      <button
        onClick={() => setEditing('new')}
        aria-label="Add title"
        className="fab-add"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <DetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onEdit={(item) => { setSelected(null); setEditing(item); }}
        onDelete={(item) => { setSelected(null); setDeleting(item); }}
      />

      {editing && (
        <AddEditModal
          item={editing === 'new' ? null : editing}
          activeTypeKey={typeFilter}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDelete
        item={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      {saving && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(6, 6, 10, 0.95)',
          border: '1px solid rgba(255, 119, 0, 0.25)',
          padding: '0.45rem 1.4rem',
          borderRadius: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          letterSpacing: 3,
          color: '#ff7700',
          textTransform: 'uppercase',
          zIndex: 500,
        }}>
          Saving...
        </div>
      )}

      {error && (
        <div className="save-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      <MobileNav
        typeFilter={typeFilter} onTypeFilter={setTypeFilter}
        isSearching={isSearching}
        onLogout={logout}
      />
    </>
  );
}

export default App;
