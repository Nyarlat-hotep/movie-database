const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const DELAY_MS = 260; // ~4 req/sec, well under 40/10s limit

if (!TMDB_API_KEY) {
  console.error('ERROR: Set TMDB_API_KEY env var before running');
  process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, { skip_empty_lines: true, trim: true });
  return records.map(row => row[0]).filter(Boolean);
}

function parseMovieTitle(raw) {
  const formats = [];
  let title = raw.trim();

  // Detect Blu-ray
  if (/\(BR[l]?\)/i.test(title) || /\bBR\b/.test(title)) {
    formats.push('bluray');
    title = title.replace(/\s*\(BR[l]?\)/gi, '').replace(/\s+BR\b/g, '').trim();
  } else {
    formats.push('dvd');
  }

  // Detect inline vhs note in movies sheet
  const notes = [];
  if (/\bvhs\b/i.test(title)) {
    formats.push('vhs');
    title = title.replace(/\s*[-–]?\s*vhs\b/gi, '').trim();
  }

  // Strip misc suffixes (must check after BR/vhs removal)
  const noteSuffixes = [' - steel book', ' - sealed', ' - new', ' (sealed)'];
  for (const suffix of noteSuffixes) {
    if (title.toLowerCase().endsWith(suffix.toLowerCase())) {
      notes.push(suffix.replace(/^[\s-]+/, ''));
      title = title.slice(0, title.length - suffix.length).trim();
    }
  }

  // Also strip " - new" without the dash
  if (title.toLowerCase().endsWith(' new')) {
    title = title.slice(0, title.length - 4).trim();
  }

  return { title, formats, notes: notes.join(', ') };
}

function parseShowTitle(raw) {
  // Strip trailing season info: "Buffy Seasons 1-6", "Friends Seasons 1, 2, 3", "Adventure Time 1"
  const seasonMatch = raw.match(/\s+(?:seasons?\s+)?([\d,\s&–\-]+)$/i);
  const seasons_owned = seasonMatch ? seasonMatch[0].trim().replace(/^seasons?\s+/i, '') : '';
  const searchTitle = raw.replace(/\s+(?:seasons?\s+)?([\d,\s&–\-]+)$/i, '').trim();
  return { displayTitle: searchTitle, seasons_owned, searchTitle };
}

async function fetchMovie(title) {
  await sleep(DELAY_MS);
  const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  const movie = data.results[0];

  await sleep(DELAY_MS);
  const creditsRes = await fetch(`${TMDB_BASE}/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}`);
  const credits = await creditsRes.json();
  const cast = (credits.cast || []).slice(0, 8).map(c => c.name);
  const directors = (credits.crew || []).filter(c => c.job === 'Director').map(c => c.name);

  return {
    tmdb_id: movie.id,
    year: movie.release_date ? parseInt(movie.release_date.slice(0, 4)) : null,
    synopsis: movie.overview || '',
    poster_path: movie.poster_path || null,
    cast,
    directors,
  };
}

async function fetchShow(title) {
  await sleep(DELAY_MS);
  const url = `${TMDB_BASE}/search/tv?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  const show = data.results[0];

  await sleep(DELAY_MS);
  const creditsRes = await fetch(`${TMDB_BASE}/tv/${show.id}/credits?api_key=${TMDB_API_KEY}`);
  const credits = await creditsRes.json();
  const cast = (credits.cast || []).slice(0, 8).map(c => c.name);

  await sleep(DELAY_MS);
  const detailRes = await fetch(`${TMDB_BASE}/tv/${show.id}?api_key=${TMDB_API_KEY}`);
  const detail = await detailRes.json();
  const creators = (detail.created_by || []).map(c => c.name);

  return {
    tmdb_id: show.id,
    tmdbTitle: show.name || title,
    year: show.first_air_date ? parseInt(show.first_air_date.slice(0, 4)) : null,
    synopsis: show.overview || '',
    poster_path: show.poster_path || null,
    cast,
    creators,
  };
}

async function main() {
  const movieTitlesRaw = readCsv('/Users/taylorcornelius/Downloads/DVDs - Movies.csv');
  const showTitlesRaw = readCsv('/Users/taylorcornelius/Downloads/DVDs - Shows.csv');
  const vhsTitlesRaw = readCsv('/Users/taylorcornelius/Downloads/DVDs - VHS .csv');

  // Normalize a title for dedup comparisons
  const normalize = t => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  // Build VHS lookup
  const vhsSet = new Set(vhsTitlesRaw.map(normalize));

  const movies = [];
  const seenMovies = new Map(); // normalized title -> index

  console.log(`\nProcessing ${movieTitlesRaw.length} movie entries...`);

  for (const raw of movieTitlesRaw) {
    const { title, formats, notes } = parseMovieTitle(raw);
    const key = normalize(title);

    // Check if also in VHS sheet
    if (vhsSet.has(key) && !formats.includes('vhs')) formats.push('vhs');

    if (seenMovies.has(key)) {
      // Merge formats
      const existing = movies[seenMovies.get(key)];
      for (const f of formats) {
        if (!existing.formats.includes(f)) existing.formats.push(f);
      }
      continue;
    }

    process.stdout.write(`  [movie] ${title}... `);
    let tmdb = null;
    try { tmdb = await fetchMovie(title); } catch(e) { console.error('fetch error:', e.message); }
    console.log(tmdb ? `✓ (${tmdb.year || '?'})` : '✗ no match');

    const entry = {
      id: uuidv4(),
      title,
      formats,
      notes,
      tmdb_id: tmdb?.tmdb_id || null,
      year: tmdb?.year || null,
      synopsis: tmdb?.synopsis || '',
      poster_path: tmdb?.poster_path || null,
      cast: tmdb?.cast || [],
      directors: tmdb?.directors || [],
      genres: [],
    };

    seenMovies.set(key, movies.length);
    movies.push(entry);
  }

  // VHS-only entries (in VHS sheet but not in Movies sheet)
  console.log(`\nProcessing ${vhsTitlesRaw.length} VHS entries for VHS-only titles...`);
  for (const raw of vhsTitlesRaw) {
    const title = raw.trim();
    const key = normalize(title);
    if (seenMovies.has(key)) continue;

    process.stdout.write(`  [vhs-only] ${title}... `);
    let tmdb = null;
    try { tmdb = await fetchMovie(title); } catch(e) { console.error('fetch error:', e.message); }
    console.log(tmdb ? `✓ (${tmdb.year || '?'})` : '✗ no match');

    const entry = {
      id: uuidv4(),
      title,
      formats: ['vhs'],
      notes: '',
      tmdb_id: tmdb?.tmdb_id || null,
      year: tmdb?.year || null,
      synopsis: tmdb?.synopsis || '',
      poster_path: tmdb?.poster_path || null,
      cast: tmdb?.cast || [],
      directors: tmdb?.directors || [],
      genres: [],
    };

    seenMovies.set(key, movies.length);
    movies.push(entry);
  }

  // Shows
  console.log(`\nProcessing ${showTitlesRaw.length} shows...`);
  const shows = [];
  for (const raw of showTitlesRaw) {
    const { displayTitle, seasons_owned, searchTitle } = parseShowTitle(raw);
    process.stdout.write(`  [show] ${searchTitle}... `);
    let tmdb = null;
    try { tmdb = await fetchShow(searchTitle); } catch(e) { console.error('fetch error:', e.message); }
    console.log(tmdb ? `✓ (${tmdb.year || '?'})` : '✗ no match');

    shows.push({
      id: uuidv4(),
      title: tmdb?.tmdbTitle || displayTitle,
      seasons_owned,
      formats: ['dvd'],
      notes: '',
      tmdb_id: tmdb?.tmdb_id || null,
      year: tmdb?.year || null,
      synopsis: tmdb?.synopsis || '',
      poster_path: tmdb?.poster_path || null,
      cast: tmdb?.cast || [],
      creators: tmdb?.creators || [],
      genres: [],
    });
  }

  const library = { movies, shows };
  const outPath = path.join(__dirname, '../src/data/library.json');
  fs.writeFileSync(outPath, JSON.stringify(library, null, 2));

  const noPosters = movies.filter(m => !m.poster_path).length;
  console.log(`\n✅ Done!`);
  console.log(`   Movies: ${movies.length} (incl. VHS-only)`);
  console.log(`   Shows:  ${shows.length}`);
  console.log(`   No TMDB poster: ${noPosters} movies`);
  console.log(`   Written to: src/data/library.json`);
}

main().catch(console.error);
