-- Vault — schema for the `items` table.
--
-- The hosted Supabase project is the live source of truth; this file is the
-- version-controlled record of it. They do not sync automatically. When you
-- change the schema, run it in the Supabase SQL editor AND mirror it here in
-- the same commit, with a matching file under migrations/.
--
-- This matters more than it looks: adding the music and games media types
-- failed at runtime on a CHECK constraint that existed only in the hosted
-- project and appeared nowhere in the repo, so there was no way to know about
-- it until Postgres rejected the insert.
--
-- To verify this file against the live database, run in the SQL editor:
--
--   select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--   where table_name = 'items'
--   order by ordinal_position;
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'items'::regclass;
--
-- Row-level security policies are NOT captured here — the browser writes with
-- the anon key, so any new table or column needs its policies checked in the
-- dashboard.

create table if not exists items (
  id            uuid primary key,          -- generated client-side (uuidv4)
  type          text not null,             -- media type discriminator
  title         text not null,
  year          int,
  synopsis      text,
  -- TMDB-relative path ("/A3WGC….jpg") for film and TV; an absolute URL for
  -- music (Cover Art Archive / iTunes) and games (IGDB). src/utils/format.js
  -- prepends the TMDB host only when the value isn't already absolute.
  poster_path   text,
  notes         text default '',
  created_at    timestamptz not null default now(),

  -- "cast" is a reserved SQL keyword and must stay quoted
  "cast"        text[] default '{}',
  genres        text[] default '{}',
  -- dvd | bluray | vhs for film and TV; cd | vinyl for music.
  -- Games filter on platforms instead — see src/utils/mediaTypes.js
  formats       text[] default '{}',

  -- film / TV
  tmdb_id       int,
  directors     text[] default '{}',
  creators      text[] default '{}',
  seasons_owned text,

  -- music
  mb_id         text,                      -- MusicBrainz release-group id
  artists       text[] default '{}',
  label         text,
  track_count   int,

  -- games
  igdb_id       bigint,
  platforms     text[] default '{}',       -- the games sub-filter axis
  developers    text[] default '{}',
  publishers    text[] default '{}',

  -- Keep in step with MEDIA_TYPES in src/utils/mediaTypes.js. A new media type
  -- needs adding here or every insert of it is rejected with SQLSTATE 23514.
  constraint items_type_check check (type in ('movie', 'show', 'music', 'game'))
);
