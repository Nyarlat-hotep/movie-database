-- Add the music and games media types.
-- Applied to the hosted project on 2026-08-29.
--
-- Numbering starts at 0001 because the table predates any migration files —
-- schema.sql is the record of what existed before this point.

-- Music
alter table items add column if not exists mb_id       text;
alter table items add column if not exists artists     text[] default '{}';
alter table items add column if not exists label       text;
alter table items add column if not exists track_count int;

-- Games. platforms is the sub-filter axis, in place of formats.
alter table items add column if not exists igdb_id     bigint;
alter table items add column if not exists platforms   text[] default '{}';
alter table items add column if not exists developers  text[] default '{}';
alter table items add column if not exists publishers  text[] default '{}';

-- The column was created allowing only 'movie' and 'show', so Postgres rejected
-- every music and game insert with SQLSTATE 23514 long before RLS was reached.
-- The constraint lived only in the hosted project, which is why this file and
-- schema.sql now exist.
alter table items drop constraint if exists items_type_check;

alter table items add constraint items_type_check
  check (type in ('movie', 'show', 'music', 'game'));
