import { Film, Tv, Disc3, Gamepad2 } from 'lucide-react';

// Single source of truth for every media type in the vault.
// Adding a fifth type should mean adding an entry here, not editing components.
export const MEDIA_TYPES = {
  movies: {
    key: 'movies',
    dbValue: 'movie',
    label: 'Movies',
    icon: Film,
    typeBadge: null,              // movies are the default — no badge
    searchBadge: 'FILM',          // but mixed search results label everything
    aspectRatio: '2 / 3',
    facetField: 'formats',
    facets: ['dvd', 'bluray', 'vhs'],
    creditFields: [
      { field: 'directors', label: 'Directed by' },
      { field: 'cast',      label: 'Cast' },
    ],
    searchEndpoint: '/api/search-tmdb',
    searchPayload: { type: 'movie' },
    searchPlaceholder: 'Search TMDB to auto-fill...',
  },

  shows: {
    key: 'shows',
    dbValue: 'show',
    label: 'TV',
    icon: Tv,
    typeBadge: 'TV',
    searchBadge: 'TV',
    aspectRatio: '2 / 3',
    facetField: 'formats',
    facets: ['dvd', 'bluray', 'vhs'],
    creditFields: [
      { field: 'creators', label: 'Created by' },
      { field: 'cast',     label: 'Cast' },
    ],
    searchEndpoint: '/api/search-tmdb',
    searchPayload: { type: 'tv' },
    searchPlaceholder: 'Search TMDB to auto-fill...',
  },

  music: {
    key: 'music',
    dbValue: 'music',
    label: 'Music',
    icon: Disc3,
    typeBadge: 'MUSIC',
    searchBadge: 'MUSIC',
    aspectRatio: '1 / 1',         // album art is square
    facetField: 'formats',
    facets: ['cd', 'vinyl'],
    creditFields: [
      { field: 'artists', label: 'Artist' },
    ],
    searchEndpoint: '/api/search-music',
    searchPayload: {},
    searchPlaceholder: 'Search MusicBrainz to auto-fill...',
  },

  games: {
    key: 'games',
    dbValue: 'game',
    label: 'Games',
    icon: Gamepad2,
    typeBadge: 'GAME',
    searchBadge: 'GAME',
    aspectRatio: '3 / 4',
    facetField: 'platforms',      // games filter by system, not by format
    facets: null,                 // derived from library contents at runtime
    creditFields: [
      { field: 'developers', label: 'Developer' },
      { field: 'publishers', label: 'Publisher' },
    ],
    searchEndpoint: '/api/search-igdb',
    searchPayload: {},
    searchPlaceholder: 'Search IGDB to auto-fill...',
  },
};

export const MEDIA_TYPE_LIST = Object.values(MEDIA_TYPES);

// db value ('movie') -> registry entry. Used by every render path.
const BY_DB_VALUE = Object.fromEntries(
  MEDIA_TYPE_LIST.map(t => [t.dbValue, t])
);

export function mediaTypeOf(item) {
  return BY_DB_VALUE[item?._type] ?? MEDIA_TYPES.movies;
}

export const DEFAULT_TYPE_FILTER = 'movies';

// ── Facets (formats + platforms) ──────────────────────────────────────────
export const FACET_LABELS = {
  dvd:    'DVD',
  bluray: 'BR',
  vhs:    'VHS',
  cd:     'CD',
  vinyl:  'VINYL',
};

export const FACET_COLORS = {
  dvd:    'rgba(255,255,255,0.3)',
  bluray: '#22d3ee',
  vhs:    '#f5c842',
  cd:     '#c084fc',
  vinyl:  '#f472b6',
};

// Derived platform chips have no entry above — fall back to one shared colour.
export const PLATFORM_COLOR = '#4ade80';

export const facetLabel = (facet) => FACET_LABELS[facet] ?? facet.toUpperCase();
export const facetColor = (facet) => FACET_COLORS[facet] ?? PLATFORM_COLOR;

// ── Search ────────────────────────────────────────────────────────────────
// Array columns searched alongside title when the user types a query.
export const SEARCHABLE_PEOPLE_FIELDS = [
  'artists', 'developers', 'publishers', 'directors', 'creators', 'cast',
];

// ── Persistence ───────────────────────────────────────────────────────────
// Whitelist for toRow(). The form object carries UI-only keys and, when the
// type is switched mid-edit, stale fields from the previous type; anything not
// listed here must never reach Supabase.
export const DB_COLUMNS = [
  'id', 'type', 'title', 'year', 'synopsis', 'poster_path', 'notes',
  'cast', 'genres', 'formats',
  'tmdb_id', 'directors', 'creators', 'seasons_owned',
  'mb_id', 'artists', 'label', 'track_count',
  'igdb_id', 'platforms', 'developers', 'publishers',
];

// Columns that only belong to one media type. On save, every column not owned
// by the item's own type is reset, so switching type mid-form can't smuggle
// stale values into the row.
export const TYPE_OWNED_COLUMNS = {
  movie: ['tmdb_id', 'directors'],
  show:  ['tmdb_id', 'creators', 'seasons_owned'],
  music: ['mb_id', 'artists', 'label', 'track_count'],
  game:  ['igdb_id', 'platforms', 'developers', 'publishers'],
};

const ALL_TYPE_OWNED = [...new Set(Object.values(TYPE_OWNED_COLUMNS).flat())];

const EMPTY_FOR = {
  tmdb_id: null, igdb_id: null, mb_id: null,
  seasons_owned: null, label: null, track_count: null,
  directors: [], creators: [], artists: [], platforms: [], developers: [], publishers: [],
};

// Blank out every type-specific column the given dbValue doesn't own.
export function clearForeignFields(entry, dbValue) {
  const owned = new Set(TYPE_OWNED_COLUMNS[dbValue] ?? []);
  const out = { ...entry };
  for (const col of ALL_TYPE_OWNED) {
    if (!owned.has(col)) out[col] = EMPTY_FOR[col];
  }
  return out;
}
