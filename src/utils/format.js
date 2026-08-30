// Facet labels/colours now live in the media-type registry; re-exported here
// so existing imports keep working.
export {
  FACET_LABELS as FORMAT_LABELS,
  FACET_COLORS as FORMAT_COLORS,
  facetLabel,
  facetColor,
} from './mediaTypes.js';

// Film/TV posters are stored as TMDB-relative paths ("/A3WGC….jpg") and get the
// CDN host prepended at render time. Album art and game covers are absolute
// URLs from Cover Art Archive / iTunes / IGDB, so they pass through untouched.
export const artworkUrl = (path, size = 'w342') => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

// Legacy alias — same behaviour, kept so older call sites don't all have to
// change at once.
export const TMDB_POSTER_URL = artworkUrl;
