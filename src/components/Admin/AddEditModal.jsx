import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { artworkUrl } from '../../utils/format.js';
import {
  MEDIA_TYPES, MEDIA_TYPE_LIST, mediaTypeOf,
  facetLabel, facetColor, clearForeignFields,
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

// `_facets` drives the row's chips and is not a column. toRow() would drop it
// anyway, but the modal shouldn't emit fields the data layer has to clean up.
const stripUiFields = (entry) => {
  const copy = { ...entry };
  delete copy._facets;
  return copy;
};

// A search result straight to a DB-ready entry, skipping the form. `_facets`
// is the chip set offered for the row and never reaches Supabase — toRow()
// whitelists real columns.
function entryFromResult(r, type) {
  const entry = {
    id: uuidv4(),
    _type: type.dbValue,
    title: r.title || '',
    year: r.year ? parseInt(r.year) : null,
    synopsis: r.synopsis || '',
    poster_path: r.poster_path ?? null,
    notes: '',
    genres: [],
    cast: r.cast || [],
    directors: r.directors || [],
    creators: r.creators || [],
    artists: r.artists || [],
    developers: r.developers || [],
    publishers: r.publishers || [],
    platforms: r.platforms || [],
    tmdb_id: r.tmdb_id ?? null,
    mb_id: r.mb_id ?? null,
    igdb_id: r.igdb_id ?? null,
    label: r.label ?? null,
    track_count: r.track_count ?? null,
    // MusicBrainz reports the pressing's real format; otherwise fall back to
    // the type's default (DVD for film/TV, CD for music).
    formats: r.formats?.length ? r.formats : defaultFacets(type.key),
  };

  // Games have no fixed facet list — the chips are whichever systems IGDB
  // returned, all owned by default so a single-platform title needs no clicks.
  if (type.facetField === 'formats') {
    entry._facets = type.facets;
  } else {
    entry.formats = [];
    entry._facets = r.platforms || [];
  }

  return clearForeignFields(entry, type.dbValue);
}

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
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null); // {tone:'empty'|'error', text}
  const [pending, setPending] = useState([]);   // queued entries, add mode only
  const [savingAll, setSavingAll] = useState(false);
  // Manual entry is the exception, not the default route — keep it folded away.
  const [manualOpen, setManualOpen] = useState(false);
  const resetTimer = useRef(null);
  const searchInput = useRef(null);

  // A single fetch reports no real progress, and the sources vary widely in
  // speed (TMDB is ~1s, MusicBrainz 4-5s once it retries a 503). So trickle
  // toward 90% on a decaying curve and let completion snap it to 100.
  useEffect(() => {
    if (!searching) return;
    const id = setInterval(() => {
      setProgress(p => (p >= 90 ? p : p + Math.max(0.6, (90 - p) * 0.06)));
    }, 110);
    return () => clearInterval(id);
  }, [searching]);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleTypeChange = (nextKey) => {
    setTypeKey(nextKey);
    // Facets are type-scoped, so carrying DVD into a music record makes no
    // sense. Reset to the new type's default.
    setForm(f => ({ ...f, formats: defaultFacets(nextKey) }));
    setResults([]);
    setSelectedKey(null);
    setMessage(null);
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    clearTimeout(resetTimer.current);
    setSearching(true);
    setResults([]);
    setMessage(null);
    setProgress(8);
    try {
      const res = await fetch(type.searchEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, ...type.searchPayload }),
      });
      const data = await res.json();

      if (!res.ok) {
        // A failed request is not the same as a title that isn't in the
        // database — saying "no results" here would send you hunting for a
        // typo when the real problem is a missing API key or a dead upstream.
        setMessage({
          tone: 'error',
          text: data?.error
            ? `${type.sourceName} search failed — ${data.error}`
            : `${type.sourceName} search failed (${res.status}).`,
        });
      } else if (!Array.isArray(data) || data.length === 0) {
        setMessage({
          tone: 'empty',
          text: `No results for "${query}" on ${type.sourceName}. Check the spelling, or enter it by hand below.`,
        });
        // The message points at the manual form, so open it rather than making
        // them find it.
        setManualOpen(true);
      } else {
        setResults(data);
      }
    } catch {
      setMessage({
        tone: 'error',
        text: `Couldn't reach ${type.sourceName}. Check your connection, or enter it by hand below.`,
      });
    } finally {
      setSearching(false);
      setProgress(100);
      // let the fill animation land before the bar clears
      resetTimer.current = setTimeout(() => setProgress(0), 450);
    }
  };

  // API results carry different id fields per source; use whichever is present.
  const resultKey = (r) => r.tmdb_id ?? r.mb_id ?? r.igdb_id ?? r.title;

  // Editing fills the form. Adding queues the result and clears the search, so
  // a stack of discs is search-click-search-click with no round trip.
  const handleSelectResult = (r) => {
    if (isEdit) {
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
      return;
    }

    setPending(p => [...p, entryFromResult(r, type)]);
    setResults([]);
    setSelectedKey(null);
    setSearchQuery('');
    searchInput.current?.focus();
  };

  const togglePendingFacet = (id, facet) => {
    setPending(p => p.map(entry => {
      if (entry.id !== id) return entry;
      // formats for film/TV/music, platforms for games
      const key = mediaTypeOf(entry).facetField;
      const current = entry[key] || [];
      return {
        ...entry,
        [key]: current.includes(facet)
          ? current.filter(x => x !== facet)
          : [...current, facet],
      };
    }));
  };

  const removePending = (id) => setPending(p => p.filter(e => e.id !== id));

  const toggleFacet = (facet) => {
    setForm(f => ({
      ...f,
      formats: (f.formats || []).includes(facet)
        ? f.formats.filter(x => x !== facet)
        : [...(f.formats || []), facet],
    }));
  };

  const entryFromForm = () => {
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
    const built = clearForeignFields(entry, type.dbValue);
    built._facets = type.facetField === 'formats' ? type.facets : built.platforms;
    return built;
  };

  // Edit mode saves the single item it opened with.
  const handleSaveEdit = () => onSave(entryFromForm());

  // Add mode: the form is the manual path for anything the databases don't
  // have. It queues rather than saving, so there is one way in and one way out.
  const handleAddToList = () => {
    if (!form.title.trim()) return;
    setPending(p => [...p, entryFromForm()]);
    setForm({ ...BLANK_FORM, formats: defaultFacets(typeKey) });
    setResults([]);
    setSearchQuery('');
  };

  const handleSaveAll = async () => {
    if (!pending.length) return;
    setSavingAll(true);
    try {
      // Strip the UI-only chip list before the entries leave the modal.
      const failed = await onSave(pending.map(stripUiFields));
      // Anything rejected stays in the list so the work isn't lost.
      if (Array.isArray(failed) && failed.length) {
        const ids = new Set(failed.map(f => f.id));
        setPending(p => p.filter(e => ids.has(e.id)));
      }
    } finally {
      setSavingAll(false);
    }
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
            ref={searchInput}
            placeholder={type.searchPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn-tmdb-search" onClick={handleSearch} disabled={searching}>
            {searching ? '...' : 'Search'}
          </button>
        </div>

        {progress > 0 && (
          <div className="search-progress">
            <div
              className="search-progress-track"
              role="progressbar"
              aria-label={`Searching ${type.sourceName}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div className="search-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="search-progress-label">
              {searching ? `Searching ${type.sourceName}...` : 'Done'}
            </div>
          </div>
        )}

        {message && (
          <div className={`search-message search-message--${message.tone}`} role="status">
            {message.text}
          </div>
        )}

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

        {pending.length > 0 && (
          <div className="pending-list">
            <div className="pending-heading">
              Pending ({pending.length}) — nothing is saved until you save
            </div>
            {pending.map(entry => {
              const rowType = mediaTypeOf(entry);
              const owned = entry[rowType.facetField] || [];
              return (
                <div className="pending-row" key={entry.id}>
                  {entry.poster_path
                    ? <img className="pending-thumb" src={artworkUrl(entry.poster_path, 'w92')} alt="" />
                    : <div className="pending-thumb pending-thumb--empty" />}
                  <span className="pending-badge">{rowType.searchBadge}</span>
                  <span className="pending-title">
                    {entry.title}
                    {entry.year ? <span className="pending-year"> {entry.year}</span> : null}
                  </span>
                  <span className="pending-facets">
                    {(entry._facets || []).map(facet => (
                      <button
                        key={facet}
                        type="button"
                        className={`pending-chip ${owned.includes(facet) ? 'on' : ''}`}
                        style={{ '--chip-color': facetColor(facet) }}
                        onClick={() => togglePendingFacet(entry.id, facet)}
                        aria-pressed={owned.includes(facet)}
                      >
                        {facetLabel(facet)}
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    className="pending-remove"
                    onClick={() => removePending(entry.id)}
                    aria-label={`Remove ${entry.title}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!isEdit && (
          <button
            type="button"
            className={`manual-toggle ${manualOpen ? 'open' : ''}`}
            onClick={() => setManualOpen(o => !o)}
            aria-expanded={manualOpen}
          >
            <ChevronDown size={14} strokeWidth={2} />
            <span>Enter one by hand</span>
          </button>
        )}

        <AnimatePresence initial={false}>
        {(isEdit || manualOpen) && (
        <motion.div
          key="manual-form"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: 'hidden' }}
        >
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
        </motion.div>
        )}
        </AnimatePresence>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          {isEdit ? (
            <button className="btn-save" onClick={handleSaveEdit}>Save</button>
          ) : (
            <>
              {manualOpen && (
                <button
                  className="btn-add-list"
                  onClick={handleAddToList}
                  disabled={!form.title.trim()}
                >
                  Add to list
                </button>
              )}
              <button
                className="btn-save"
                onClick={handleSaveAll}
                disabled={!pending.length || savingAll}
              >
                {savingAll ? 'Saving...' : `Save all${pending.length ? ` (${pending.length})` : ''}`}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
