const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org';
const ITUNES_BASE = 'https://itunes.apple.com/search';

// A band search should return a discography. The MusicBrainz call is already
// one request for 100 pressings; this only adds cover-art probes, which are
// unmetered and run in parallel.
const MAX_RESULTS = 25;

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

// Lucene reserves these; dismax queries are raw text but a fielded query is not.
const escapeLucene = (s) => s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');

// dismax scores an exact title match at 100 whatever the artist, so a bare band
// name returns records *called* "Radiohead" rather than Radiohead's albums. A
// fielded artist query returns the discography instead. Only worth the extra
// round trip (MusicBrainz allows one request a second) when the query is short
// enough to plausibly be a band name — "kid a radiohead" is already served well
// by dismax and shouldn't pay for this.
const looksLikeArtist = (q) => q.trim().split(/\s+/).length <= 2;

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

// iTunes carries no physical-format data, so `formats` comes back empty and the
// user ticks CD/Vinyl themselves.
const itunesEntry = (r) => ({
  mb_id: null,
  title: r.collectionName || '',
  year: (r.releaseDate || '').slice(0, 4),
  artists: r.artistName ? [r.artistName] : [],
  label: null,
  track_count: r.trackCount || null,
  formats: [],
  poster_path: itunesArt(r),
  synopsis: '',
});

// Used when MusicBrainz is unavailable.
function fromItunes(itunesResults) {
  return itunesResults.slice(0, MAX_RESULTS).map(itunesEntry);
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

  // For a probable band name, put that artist's own releases ahead of whatever
  // merely shares its title.
  let releases = data.releases || [];
  if (looksLikeArtist(query)) {
    const artistRes = await mbFetch(
      `${MB_BASE}/release?query=artist:(${encodeURIComponent(escapeLucene(query))})&fmt=json&limit=100`
    );
    if (artistRes?.ok) {
      const artistData = await artistRes.json();
      releases = [...(artistData.releases || []), ...releases];
    }
  }

  // Search returns every pressing of an album. Group by release group, keeping
  // MusicBrainz's score order.
  const groups = new Map();
  for (const rel of releases) {
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
    .slice(0, MAX_RESULTS)
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

  // MusicBrainz's dismax matches release TITLES, so a bare band name returns
  // records *called* "Radiohead" by unrelated artists rather than Radiohead's
  // discography. iTunes indexes by artist and is already fetched above at no
  // extra cost, so fold in whatever it found that MusicBrainz missed.
  const seen = new Set(results.map(r => normalize(r.title)));
  const extras = [];
  for (const r of itunesResults) {
    const key = normalize(r.collectionName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    extras.push(itunesEntry(r));
  }

  // Deliberately no re-ranking on top of this. Boosting exact artist matches
  // was tried and made things worse: "the dark side of the moon" promoted a
  // band of that name over Pink Floyd, and "slipknot" promoted tribute covers.
  // MusicBrainz's own relevance leads; the iTunes entries follow.
  return res.status(200).json([...results, ...extras].slice(0, MAX_RESULTS));
}
