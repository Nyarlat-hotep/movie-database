import { useState, useMemo } from 'react';
import libraryData from '../data/library.json';

export function useLibrary() {
  const [library, setLibrary] = useState(libraryData);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState(null);
  const [saving, setSaving] = useState(false);

  const allItems = useMemo(() => [
    ...library.movies.map(m => ({ ...m, _type: 'movie' })),
    ...library.shows.map(s => ({ ...s, _type: 'show' })),
  ], [library]);

  const filtered = useMemo(() => {
    let items = allItems;
    if (typeFilter === 'movies') items = items.filter(i => i._type === 'movie');
    if (typeFilter === 'shows') items = items.filter(i => i._type === 'show');
    if (formatFilter) items = items.filter(i => i.formats.includes(formatFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    return [...items].sort((a, b) => a.title.localeCompare(b.title));
  }, [allItems, typeFilter, formatFilter, search]);

  async function saveLibrary(updatedLibrary) {
    setSaving(true);
    try {
      const res = await fetch('/.netlify/functions/save-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLibrary),
      });
      if (!res.ok) throw new Error('Save failed');
      setLibrary(updatedLibrary);
    } finally {
      setSaving(false);
    }
  }

  function addItem(item) {
    const updated = item._type === 'movie'
      ? { ...library, movies: [...library.movies, item] }
      : { ...library, shows: [...library.shows, item] };
    return saveLibrary(updated);
  }

  function editItem(item) {
    const updated = item._type === 'movie'
      ? { ...library, movies: library.movies.map(m => m.id === item.id ? item : m) }
      : { ...library, shows: library.shows.map(s => s.id === item.id ? item : s) };
    return saveLibrary(updated);
  }

  function removeItem(item) {
    const updated = item._type === 'movie'
      ? { ...library, movies: library.movies.filter(m => m.id !== item.id) }
      : { ...library, shows: library.shows.filter(s => s.id !== item.id) };
    return saveLibrary(updated);
  }

  return {
    filtered, search, setSearch,
    typeFilter, setTypeFilter,
    formatFilter, setFormatFilter,
    addItem, editItem, removeItem,
    saving,
  };
}
