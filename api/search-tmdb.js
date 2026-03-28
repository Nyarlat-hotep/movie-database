const TMDB_BASE = 'https://api.themoviedb.org/3';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, type = 'movie' } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TMDB_API_KEY not configured' });
  }

  const endpoint = type === 'tv' ? 'search/tv' : 'search/movie';
  const searchRes = await fetch(
    `${TMDB_BASE}/${endpoint}?query=${encodeURIComponent(query)}&api_key=${apiKey}`
  );
  const searchData = await searchRes.json();
  const results = (searchData.results || []).slice(0, 5);

  const enriched = await Promise.all(
    results.map(async (item) => {
      const mediaType = type === 'tv' ? 'tv' : 'movie';
      const creditsRes = await fetch(
        `${TMDB_BASE}/${mediaType}/${item.id}/credits?api_key=${apiKey}`
      );
      const credits = await creditsRes.json();
      const cast = (credits.cast || []).slice(0, 8).map(c => c.name);
      const directors = type === 'movie'
        ? (credits.crew || []).filter(c => c.job === 'Director').map(c => c.name)
        : [];

      let creators = [];
      if (type === 'tv') {
        const detailRes = await fetch(`${TMDB_BASE}/tv/${item.id}?api_key=${apiKey}`);
        const detail = await detailRes.json();
        creators = (detail.created_by || []).map(c => c.name);
      }

      return {
        tmdb_id: item.id,
        title: item.title || item.name || '',
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        synopsis: item.overview || '',
        poster_path: item.poster_path || null,
        cast,
        directors,
        creators,
      };
    })
  );

  return res.status(200).json(enriched);
}
