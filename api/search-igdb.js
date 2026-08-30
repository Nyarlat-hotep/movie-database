const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_BASE = 'https://api.igdb.com/v4';
const IGDB_IMAGE = 'https://images.igdb.com/igdb/image/upload';

// IGDB blocks browser CORS, so all data calls go through here. The image CDN
// is CORS-open, so cover URLs are safe to hand straight to the client.

// Twitch client-credentials tokens last ~60 days. Cache in module scope so a
// warm function reuses one instead of minting a token per request.
let cachedToken = null;
let cachedExpiry = 0;

async function getToken(force = false) {
  if (!force && cachedToken && Date.now() < cachedExpiry) return cachedToken;

  const params = new URLSearchParams({
    client_id: process.env.IGDB_CLIENT_ID,
    client_secret: process.env.IGDB_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const res = await fetch(`${TWITCH_TOKEN_URL}?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`);

  const data = await res.json();
  cachedToken = data.access_token;
  // Expire a minute early to avoid racing the boundary.
  cachedExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

const FIELDS = [
  'name',
  'first_release_date',
  'summary',
  'cover.image_id',
  'platforms.abbreviation',
  'platforms.name',
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher',
].join(',');

async function queryGames(query, token) {
  return fetch(`${IGDB_BASE}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    // APIcalypse. Escape quotes so a title containing one can't break the query.
    body: `search "${query.replace(/"/g, '\\"')}"; fields ${FIELDS}; limit 5;`,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }
  if (!process.env.IGDB_CLIENT_ID || !process.env.IGDB_CLIENT_SECRET) {
    return res.status(500).json({ error: 'IGDB credentials not configured' });
  }

  let igdbRes;
  try {
    igdbRes = await queryGames(query, await getToken());
    // A cached token can be revoked server-side; mint a fresh one and retry once.
    if (igdbRes.status === 401) {
      igdbRes = await queryGames(query, await getToken(true));
    }
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  if (!igdbRes.ok) {
    return res.status(502).json({ error: `IGDB error ${igdbRes.status}` });
  }
  const games = await igdbRes.json();

  const results = (games || []).map(g => {
    const companies = g.involved_companies || [];
    return {
      igdb_id: g.id,
      title: g.name || '',
      year: g.first_release_date
        ? String(new Date(g.first_release_date * 1000).getUTCFullYear())
        : '',
      synopsis: g.summary || '',
      // t_cover_big_2x is 528x748 — enough for the 3:4 card at retina density.
      poster_path: g.cover?.image_id
        ? `${IGDB_IMAGE}/t_cover_big_2x/${g.cover.image_id}.jpg`
        : null,
      platforms: (g.platforms || [])
        .map(p => p.abbreviation || p.name)
        .filter(Boolean),
      developers: companies.filter(c => c.developer).map(c => c.company?.name).filter(Boolean),
      publishers: companies.filter(c => c.publisher).map(c => c.company?.name).filter(Boolean),
    };
  });

  return res.status(200).json(results);
}
