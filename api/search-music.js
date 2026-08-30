const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org';
const ITUNES_BASE = 'https://itunes.apple.com/search';

// MusicBrainz requires a descriptive User-Agent with contact info and rejects
// requests without one.
const contact = process.env.MUSICBRAINZ_CONTACT || 'vault@example.com';
const USER_AGENT = `Vault/1.0 ( ${contact} )`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// MusicBrainz load-sheds aggressively on shared IPs (serverless egress is
// shared), answering 503 with a retry-after. Back off and retry before giving
// up; a single retry is not enough in practice.
async function mbFetch(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status !== 503) return res;
    const retryAfter = parseFloat(res.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1000 * (i + 1);           // 1s, 2s, 3s
    await sleep(wait);
  }
  return null;
}

// 'CD' / '10" Vinyl' / 'Cassette' -> our facet keys. Anything else (DVD-Video,
// digital media) has no facet and is dropped.
function toFacets(media) {
  const facets = new Set();
  for (const m of media || []) {
    const f = (m.format || '').toLowerCase();
    if (f.includes('vinyl')) facets.add('vinyl');
    else if (f.includes('cd')) facets.add('cd');
  }
  return [...facets];
}

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Cover Art Archive has no entry for plenty of releases — probe before using it.
async function coverArtUrl(releaseGroupId) {
  try {
    const res = await fetch(`${CAA_BASE}/release-group/${releaseGroupId}/front-500`, {
      method: 'HEAD',
      redirect: 'follow',
    });
    return res.ok ? `${CAA_BASE}/release-group/${releaseGroupId}/front-500` : null;
  } catch {
    return null;
  }
}

// One iTunes call per search. Serves double duty: artwork for releases Cover
// Art Archive doesn't have, and a complete result set if MusicBrainz is down.
async function itunesSearch(query) {
  try {
    const res = await fetch(
      `${ITUNES_BASE}?term=${encodeURIComponent(query)}&entity=album&limit=25`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// artworkUrl100 upsizes by string replacement.
const itunesArt = (r) =>
  r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb', '600x600bb') : null;

function artworkByTitle(itunesResults) {
  const map = {};
  for (const r of itunesResults) {
    const key = normalize(r.collectionName);
    if (key && !map[key]) map[key] = itunesArt(r);
  }
  return map;
}

// Used when MusicBrainz is unavailable. iTunes carries no physical-format data,
// so `formats` comes back empty and the user ticks CD/Vinyl themselves.
function fromItunes(itunesResults) {
  return itunesResults.slice(0, 5).map(r => ({
    mb_id: null,
    title: r.collectionName || '',
    year: (r.releaseDate || '').slice(0, 4),
    artists: r.artistName ? [r.artistName] : [],
    label: null,
    track_count: r.trackCount || null,
    formats: [],
    poster_path: itunesArt(r),
    synopsis: '',
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  // A single release search returns title, date, artist, label, and the
  // physical format + track count inline — no per-result follow-up needed.
  const [searchRes, itunesResults] = await Promise.all([
    // dismax=true makes MusicBrainz treat this as a free-text query across
    // fields. Without it the raw Lucene parser reads "kid a radiohead" as a
    // field-less boolean and returns near-random matches.
    // limit=100 because a popular album has dozens of pressings and they all
    // collapse to one release group below — a small limit yields one result.
    mbFetch(`${MB_BASE}/release?query=${encodeURIComponent(query)}&dismax=true&fmt=json&limit=100`),
    itunesSearch(query),
  ]);

  // MusicBrainz sheds load often enough that failing outright would be a poor
  // experience. Fall back to iTunes rather than returning nothing.
  if (!searchRes || !searchRes.ok) {
    return res.status(200).json(fromItunes(itunesResults));
  }
  const data = await searchRes.json();

  // Search returns every pressing of an album. Group by release group, keeping
  // MusicBrainz's score order.
  const groups = new Map();
  for (const rel of data.releases || []) {
    const rgId = rel['release-group']?.id;
    if (!rgId) continue;
    if (!groups.has(rgId)) groups.set(rgId, []);
    groups.get(rgId).push(rel);
  }

  // Within a group, prefer the pressing most likely to be the one on a shelf:
  // a physical CD/vinyl, single-disc over a deluxe reissue, earliest release.
  function representative(pressings) {
    return [...pressings].sort((a, b) => {
      const physical = r => (toFacets(r.media).length ? 0 : 1);
      if (physical(a) !== physical(b)) return physical(a) - physical(b);
      const discs = r => (r.media || []).length || 99;
      if (discs(a) !== discs(b)) return discs(a) - discs(b);
      return (a.date || '9999').localeCompare(b.date || '9999');
    })[0];
  }

  const picks = [...groups.entries()]
    .slice(0, 5)
    .map(([rgId, pressings]) => ({ rgId, rel: representative(pressings) }));

  const covers = await Promise.all(picks.map(p => coverArtUrl(p.rgId)));
  const itunesMap = artworkByTitle(itunesResults);

  const results = picks.map(({ rel, rgId }, i) => {
    const media = rel.media || [];
    return {
      mb_id: rgId,
      title: rel.title || '',
      year: (rel.date || '').slice(0, 4),
      artists: (rel['artist-credit'] || []).map(a => a.name).filter(Boolean),
      label: rel['label-info']?.[0]?.label?.name || null,
      track_count: media.reduce((sum, m) => sum + (m['track-count'] || 0), 0) || null,
      formats: toFacets(media),
      poster_path: covers[i] || itunesMap[normalize(rel.title)] || null,
      synopsis: '',
    };
  });

  return res.status(200).json(results);
}
