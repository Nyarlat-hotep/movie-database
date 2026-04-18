// One-time migration: imports library.json into Supabase
// Usage: node scripts/migrate-to-supabase.js
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually (no dotenv dependency needed)
const envPath = join(__dirname, '../.env.local')
const envVars = readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const [k, ...v] = line.split('=')
    acc[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
    return acc
  }, {})

const url  = envVars.VITE_SUPABASE_URL
const key  = envVars.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

const { movies, shows } = JSON.parse(
  readFileSync(join(__dirname, '../src/data/library.json'), 'utf8')
)

const items = [
  ...movies.map(m => ({
    id:           m.id,
    type:         'movie',
    title:        m.title,
    tmdb_id:      m.tmdb_id   ?? null,
    year:         m.year      ?? null,
    synopsis:     m.synopsis  ?? null,
    poster_path:  m.poster_path ?? null,
    cast:         m.cast      ?? [],
    genres:       m.genres    ?? [],
    formats:      m.formats   ?? [],
    directors:    m.directors ?? [],
    creators:     [],
    seasons_owned: null,
    notes:        m.notes     ?? null,
  })),
  ...shows.map(s => ({
    id:           s.id,
    type:         'show',
    title:        s.title,
    tmdb_id:      s.tmdb_id   ?? null,
    year:         s.year      ?? null,
    synopsis:     s.synopsis  ?? null,
    poster_path:  s.poster_path ?? null,
    cast:         s.cast      ?? [],
    genres:       s.genres    ?? [],
    formats:      s.formats   ?? [],
    directors:    [],
    creators:     s.creators  ?? [],
    seasons_owned: s.seasons_owned ?? null,
    notes:        s.notes     ?? null,
  })),
]

console.log(`Migrating ${items.length} items to Supabase...`)

const BATCH = 100
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH)
  const { error } = await supabase.from('items').insert(batch)
  if (error) { console.error('Insert error:', error); process.exit(1) }
  console.log(`  ${Math.min(i + BATCH, items.length)} / ${items.length}`)
}

console.log('Done.')
