import { useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useLibrary } from './hooks/useLibrary.js';
import LoginOverlay from './components/Auth/LoginOverlay.jsx';
import Navbar from './components/Layout/Navbar.jsx';
import LibraryGrid from './components/Library/LibraryGrid.jsx';
import DetailModal from './components/Library/DetailModal.jsx';
import AddEditModal from './components/Admin/AddEditModal.jsx';
import ConfirmDelete from './components/Admin/ConfirmDelete.jsx';

function App() {
  const { user, loading, login, logout } = useAuth();
  const {
    filtered, search, setSearch,
    typeFilter, setTypeFilter,
    formatFilter, setFormatFilter,
    addItem, editItem, removeItem,
    saving,
  } = useLibrary();

  const [selected, setSelected]   = useState(null);  // item shown in DetailModal
  const [editing, setEditing]     = useState(null);  // item or 'new'
  const [deleting, setDeleting]   = useState(null);  // item pending delete

  if (loading) return null;
  if (!user) return <LoginOverlay onLogin={login} />;

  const handleSave = async (item) => {
    if (editing === 'new') await addItem(item);
    else await editItem(item);
    setEditing(null);
    setSelected(null);
  };

  const handleDelete = async (item) => {
    await removeItem(item);
    setDeleting(null);
    setSelected(null);
  };

  return (
    <>
      <Navbar
        search={search}         onSearch={setSearch}
        typeFilter={typeFilter} onTypeFilter={setTypeFilter}
        formatFilter={formatFilter} onFormatFilter={setFormatFilter}
        onLogout={logout}
      />

      <main style={{ paddingTop: '64px' }}>
        <LibraryGrid items={filtered} onSelect={setSelected} />
      </main>

      {/* Floating add button */}
      <button
        onClick={() => setEditing('new')}
        aria-label="Add title"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: 'rgba(255, 119, 0, 0.12)',
          border: '1px solid rgba(255, 119, 0, 0.45)',
          color: '#ff7700',
          fontSize: '1.4rem',
          lineHeight: 1,
          boxShadow: '0 0 18px rgba(255, 119, 0, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,119,0,0.22)';
          e.currentTarget.style.borderColor = '#ff7700';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,119,0,0.12)';
          e.currentTarget.style.borderColor = 'rgba(255,119,0,0.45)';
        }}
      >
        +
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
    </>
  );
}

export default App;
