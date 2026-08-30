import { useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { artworkUrl } from '../../utils/format.js';
import {
  MEDIA_TYPES, MEDIA_TYPE_LIST, mediaTypeOf,
  facetLabel, clearForeignFields,
} from '../../utils/mediaTypes.js';
import './AddEditModal.css';

// Comma-separated input <-> array column
const toList = (s) => (s ? s.split(',').map(x => x.trim()).filter(Boolean) : []);
const fromList = (v) => (Array.isArray(v) ? v.join(', ') : '');

const BLANK_FORM = {
  title: '', year: '', synopsis: '', poster_path: null, notes: '',
  cast: '', directors: '', creators: '', seasons_owned: '',
  artists: '', label: '', track_count: '',
  developers: '', publishers: '', platforms: '',
  formats: [],
};

// Every array column that the form edits as a comma-separated string.
const LIST_FIELDS = [
  'cast', 'directors', 'creators',
  'artists', 'developers', 'publishers', 'platforms',
];

// Default facet for a new record of this type — DVD for film/TV, CD for music,
// nothing for games (they filter on platforms).
const defaultFacets = (typeKey) => {
  const facets = MEDIA_TYPES[typeKey].facets;
  return facets?.length ? [facets[0]] : [];
};

export default function AddEditModal({ item, activeTypeKey = 'movies', onSave, onClose }) {
  const isEdit = !!item;
  // Editing keeps the item's own type; adding follows the tab you came from.
  const [typeKey, setTypeKey] = useState(() => (item ? mediaTypeOf(item).key : activeTypeKey));
  const type = MEDIA_TYPES[typeKey];

  const [form, setForm] = useState(() => {
    if (!item) return { ...BLANK_FORM, formats: defaultFacets(typeKey) };
    const loaded = { ...BLANK_FORM, ...item };
    for (const field of LIST_FIELDS) loaded[field] = fromList(item[field]);
    return loaded;
  });

  const [searchQuery, setSearchQuery] = useState(item?.title || '');
  const [results, setResults] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [searching, setSearching] = useState(false);

  const handleTypeChange = (nextKey) => {
    setTypeKey(nextKey);
    // Facets are type-scoped, so carrying DVD into a music record makes no
    // sense. Reset to the new type's default.
    setForm(f => ({ ...f, formats: defaultFacets(nextKey) }));
    setResults([]);
    setSelectedKey(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(type.searchEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, ...type.searchPayload }),
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      // search failed silently — user can still fill manually
    } finally {
      setSearching(false);
    }
  };

  // API results carry different id fields per source; use whichever is present.
  const resultKey = (r) => r.tmdb_id ?? r.mb_id ?? r.igdb_id ?? r.title;

  const handleSelectResult = (r) => {
    setSelectedKey(resultKey(r));
    setForm(f => {
      const next = {
        ...f,
        title: r.title,
        year: r.year || '',
        synopsis: r.synopsis || '',
        poster_path: r.poster_path,
      };
      // Only copy the fields this source actually returns.
      for (const field of LIST_FIELDS) {
        if (r[field]) next[field] = fromList(r[field]);
      }
      for (const field of ['tmdb_id', 'mb_id', 'igdb_id', 'label', 'track_count']) {
        if (r[field] != null) next[field] = r[field];
      }
      // MusicBrainz reports the pressing's physical format — pre-check it.
      if (r.formats?.length) next.formats = r.formats;
      return next;
    });
  };

  const toggleFacet = (facet) => {
    setForm(f => ({
      ...f,
      formats: (f.formats || []).includes(facet)
        ? f.formats.filter(x => x !== facet)
        : [...(f.formats || []), facet],
    }));
  };

  const handleSave = () => {
    const entry = {
      ...form,
      id: form.id || uuidv4(),
      _type: type.dbValue,
      year: form.year ? parseInt(form.year) : null,
      track_count: form.track_count ? parseInt(form.track_count) : null,
      genres: form.genres || [],
    };
    for (const field of LIST_FIELDS) entry[field] = toList(form[field]);
    // Games filter on `platforms`, not `formats`.
    if (type.facetField !== 'formats') entry.formats = [];
    onSave(clearForeignFields(entry, type.dbValue));
  };

  // Facet checkboxes: static list for film/TV/music. Games have no fixed set —
  // platforms come from the free-text field below instead.
  const facetChoices = type.facets;

  const field = (label, key, props = {}) => (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <input
        value={form[key] ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </div>
  );

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
          <div className="type-toggle">
            {MEDIA_TYPE_LIST.map(t => (
              <div
                key={t.key}
                className={`type-toggle-opt${typeKey === t.key ? ' active' : ''}`}
                onClick={() => handleTypeChange(t.key)}
              >
                {t.label}
              </div>
            ))}
          </div>
        )}

        <div className="search-row">
          <input
            placeholder={type.searchPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn-tmdb-search" onClick={handleSearch} disabled={searching}>
            {searching ? '...' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="tmdb-results">
            {results.map(r => (
              <div
                key={resultKey(r)}
                className={`tmdb-result-card ${selectedKey === resultKey(r) ? 'selected' : ''}`}
                onClick={() => handleSelectResult(r)}
              >
                {r.poster_path
                  ? <img src={artworkUrl(r.poster_path, 'w92')} alt={r.title} />
                  : <div className="tmdb-result-no-poster">{r.title}</div>
                }
                <div className="tmdb-result-label">{r.title}{r.year ? ` (${r.year})` : ''}</div>
              </div>
            ))}
          </div>
        )}

        <div className="form-fields">
          {field('Title', 'title')}

          <div className="form-row">
            {field('Year', 'year')}
            {typeKey === 'shows' && field('Seasons Owned', 'seasons_owned')}
            {typeKey === 'music' && field('Tracks', 'track_count')}
          </div>

          {facetChoices && (
            <div className="form-field">
              <label className="form-label">Format</label>
              <div className="format-checks">
                {facetChoices.map(facet => (
                  <label key={facet} className="format-check">
                    <input
                      type="checkbox"
                      checked={(form.formats || []).includes(facet)}
                      onChange={() => toggleFacet(facet)}
                    />
                    {facet === 'bluray' ? 'Blu-ray' : facetLabel(facet)}
                  </label>
                ))}
              </div>
            </div>
          )}

          {typeKey === 'games' && field('Systems (comma-separated)', 'platforms')}
          {typeKey === 'music' && field('Label', 'label')}

          {field('Synopsis', 'synopsis')}

          {type.creditFields.map(({ field: key, label }) => (
            <div className="form-field" key={key}>
              <label className="form-label">{label} (comma-separated)</label>
              <input
                value={form[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>Save</button>
        </div>
      </motion.div>
    </div>
  );
}
