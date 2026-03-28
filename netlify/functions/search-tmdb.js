const TMDB_BASE = 'https://api.themoviedb.org/3';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let query, type;
  try {
    const body = JSON.parse(event.body || '{}');
    query = body.query;
    type = body.type || 'movie';
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'query is required' }) };
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'TMDB_API_KEY not configured' }) };
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

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enriched),
  };
};
