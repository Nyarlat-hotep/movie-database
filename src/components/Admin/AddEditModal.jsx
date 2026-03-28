import { useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { TMDB_POSTER_URL } from '../../utils/format.js';
import './AddEditModal.css';

export default function AddEditModal({ item, onSave, onClose }) {
  const isEdit = !!item;
  const [type, setType] = useState(item?._type || 'movie');
  const [form, setForm] = useState(() => {
    if (!item) return { title: '', year: '', synopsis: '', poster_path: null, cast: '', directors: '', creators: '', seasons_owned: '', formats: ['dvd'], notes: '' };
    return {
      ...item,
      cast: Array.isArray(item.cast) ? item.cast.join(', ') : '',
      directors: Array.isArray(item.directors) ? item.directors.join(', ') : '',
      creators: Array.isArray(item.creators) ? item.creators.join(', ') : '',
    };
  });
  const [searchQuery, setSearchQuery] = useState(item?.title || '');
  const [tmdbResults, setTmdbResults] = useState([]);
  const [selectedTmdbId, setSelectedTmdbId] = useState(item?.tmdb_id || null);
  const [searching, setSearching] = useState(false);

  const handleTmdbSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setTmdbResults([]);
    try {
      const res = await fetch('/.netlify/functions/search-tmdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, type: type === 'show' ? 'tv' : 'movie' }),
      });
      const results = await res.json();
      setTmdbResults(Array.isArray(results) ? results : []);
    } catch {
      // search failed silently — user can still fill manually
    } finally {
      setSearching(false);
    }
  };

  const handleSelectTmdb = (result) => {
    setSelectedTmdbId(result.tmdb_id);
    setForm(f => ({
      ...f,
      title: result.title,
      year: result.year || '',
      synopsis: result.synopsis || '',
      poster_path: result.poster_path,
      tmdb_id: result.tmdb_id,
      cast: (result.cast || []).join(', '),
      directors: (result.directors || []).join(', '),
      creators: (result.creators || []).join(', '),
    }));
  };

  const toggleFormat = (fmt) => {
    setForm(f => ({
      ...f,
      formats: f.formats.includes(fmt)
        ? f.formats.filter(x => x !== fmt)
        : [...f.formats, fmt],
    }));
  };

  const handleSave = () => {
    const entry = {
      ...form,
      id: form.id || uuidv4(),
      _type: type,
      year: form.year ? parseInt(form.year) : null,
      cast: form.cast ? form.cast.split(',').map(s => s.trim()).filter(Boolean) : [],
      directors: form.directors ? form.directors.split(',').map(s => s.trim()).filter(Boolean) : [],
      creators: form.creators ? form.creators.split(',').map(s => s.trim()).filter(Boolean) : [],
      genres: form.genres || [],
    };
    onSave(entry);
  };

  return (
    <div className="add-edit-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="add-edit-modal"
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="add-edit-heading">{isEdit ? 'Edit Title' : 'Add Title'}</div>

        {!isEdit && (
          <div className="type-row">
            <label className="type-radio">
              <input type="radio" name="type" value="movie" checked={type === 'movie'} onChange={() => setType('movie')} />
              Movie
            </label>
            <label className="type-radio">
              <input type="radio" name="type" value="show" checked={type === 'show'} onChange={() => setType('show')} />
              TV Show
            </label>
          </div>
        )}

        <div className="search-row">
          <input
            placeholder="Search TMDB to auto-fill..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTmdbSearch()}
          />
          <button className="btn-tmdb-search" onClick={handleTmdbSearch} disabled={searching}>
            {searching ? '...' : 'Search'}
          </button>
        </div>

        {tmdbResults.length > 0 && (
          <div className="tmdb-results">
            {tmdbResults.map(r => (
              <div
                key={r.tmdb_id}
                className={`tmdb-result-card ${selectedTmdbId === r.tmdb_id ? 'selected' : ''}`}
                onClick={() => handleSelectTmdb(r)}
              >
                {r.poster_path
                  ? <img src={TMDB_POSTER_URL(r.poster_path, 'w92')} alt={r.title} />
                  : <div className="tmdb-result-no-poster">{r.title}</div>
                }
                <div className="tmdb-result-label">{r.title}{r.year ? ` (${r.year})` : ''}</div>
              </div>
            ))}
          </div>
        )}

        <div className="form-fields">
          <div className="form-field">
            <label className="form-label">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Year</label>
              <input value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
            </div>
            {type === 'show' && (
              <div className="form-field">
                <label className="form-label">Seasons Owned</label>
                <input value={form.seasons_owned || ''} onChange={e => setForm(f => ({ ...f, seasons_owned: e.target.value }))} />
              </div>
            )}
          </div>

          <div className="form-field">
            <label className="form-label">Format</label>
            <div className="format-checks">
              {['dvd', 'bluray', 'vhs'].map(fmt => (
                <label key={fmt} className="format-check">
                  <input
                    type="checkbox"
                    checked={(form.formats || []).includes(fmt)}
                    onChange={() => toggleFormat(fmt)}
                  />
                  {fmt === 'bluray' ? 'Blu-ray' : fmt.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Synopsis</label>
            <input value={form.synopsis || ''} onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))} />
          </div>

          <div className="form-field">
            <label className="form-label">{type === 'show' ? 'Created by' : 'Directed by'} (comma-separated)</label>
            <input
              value={type === 'show' ? (form.creators || '') : (form.directors || '')}
              onChange={e => setForm(f =>
                type === 'show'
                  ? { ...f, creators: e.target.value }
                  : { ...f, directors: e.target.value }
              )}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Cast (comma-separated)</label>
            <input value={form.cast || ''} onChange={e => setForm(f => ({ ...f, cast: e.target.value }))} />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>Save</button>
        </div>
      </motion.div>
    </div>
  );
}
