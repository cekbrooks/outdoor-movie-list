-- =============================================================================
-- 003 — Dedupe & normalization layer (Fix Brief Phase 1.3 / 1.4 / 1.5)
--
-- Run with the service role (SQL editor or MCP). Keep the normalization
-- logic in sync with lib/normalize.ts.
-- =============================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. Alias tables (extensible without code changes)
-- ---------------------------------------------------------------------------
create table if not exists title_aliases (
  alias      text primary key,          -- normalized alias, e.g. 'zootropolis'
  canonical  text not null,             -- normalized canonical, e.g. 'zootopia'
  created_at timestamptz not null default now()
);

insert into title_aliases (alias, canonical) values
  ('zootropolis', 'zootopia'),
  ('zootropolis 2', 'zootopia 2'),
  ('vaiana', 'moana'),
  ('vaiana 2', 'moana 2'),
  ('harry potter and the sorcerers stone', 'harry potter and the philosophers stone')
on conflict (alias) do nothing;

create table if not exists venue_aliases (
  alias      text primary key,          -- normalized alias
  canonical  text not null,             -- normalized canonical venue
  city       text,                      -- optional city scoping
  created_at timestamptz not null default now()
);

insert into venue_aliases (alias, canonical, city) values
  ('brooklyn bridge park pier 1', 'brooklyn bridge park', 'new-york'),
  ('pier 1',                      'brooklyn bridge park', 'new-york'),
  ('battery park',                'the battery',          'new-york'),
  ('bryant park lawn',            'bryant park',          'new-york'),
  ('vauxhall pleasure gardens london', 'vauxhall pleasure gardens', 'london')
on conflict (alias) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Normalization functions (immutable so they can back generated columns)
-- ---------------------------------------------------------------------------
create or replace function normalize_title(raw text)
returns text
language sql immutable
as $$
  select nullif(
    trim(both ' ' from
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(raw, '')), '&', ' and ', 'g'),
            '[''’]', '', 'g'
          ),
          '[^a-z0-9]+', ' ', 'g'
        ),
        '\s+(19|20)\d{2}$', ''
      )
    ), ''
  );
$$;

create or replace function normalize_venue(raw text)
returns text
language sql immutable
as $$
  select nullif(
    trim(both ' ' from
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(raw, '')), '&', ' and ', 'g'),
          '[''’]', '', 'g'
        ),
        '[^a-z0-9]+', ' ', 'g'
      )
    ), ''
  );
$$;

-- Resolve aliases at read time (STABLE, reads alias tables).
create or replace function canonical_title(raw text)
returns text
language sql stable
as $$
  select coalesce(
    (select canonical from title_aliases where alias = normalize_title(raw)),
    normalize_title(raw)
  );
$$;

create or replace function canonical_venue(raw text, city_slug text default null)
returns text
language sql stable
as $$
  select coalesce(
    (select canonical from venue_aliases
      where alias = normalize_venue(raw)
        and (city is null or city_slug is null or city = city_slug)
      limit 1),
    normalize_venue(raw)
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Generated columns + uniqueness for future upserts
--    (generated columns must use IMMUTABLE functions → alias resolution
--     happens in the merge pass / triggers, not here)
-- ---------------------------------------------------------------------------
alter table screenings
  add column if not exists normalized_title text
    generated always as (normalize_title(film)) stored,
  add column if not exists normalized_venue text
    generated always as (normalize_venue(venue)) stored,
  add column if not exists archived boolean not null default false;

-- Add status column for TBC handling if missing (Phase 1.5).
alter table screenings
  add column if not exists status text not null default 'confirmed';

update screenings
   set status = 'film_tbc'
 where status <> 'film_tbc'
   and (
     film is null
     or normalize_title(film) is null
     or normalize_title(film) ~ '^(tbc|tba|tbd)( |$)'
     or normalize_title(film) ~ '^to be (confirmed|announced)'
     or normalize_title(film) ~ '^(january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}( \d{4})?$'
   );

-- Drop the old constraint-equivalent index if present and add the
-- normalized one. Guarded: only if the old unique constraint exists by the
-- default name; otherwise skip silently.
do $$
begin
  begin
    create unique index if not exists screenings_city_venue_date_title_norm_uq
      on screenings (city, normalized_venue, date, normalized_title)
      where status = 'confirmed' and archived = false;
  exception when others then
    raise notice 'normalized unique index not created: %', sqlerrm;
  end;
end $$;

create index if not exists screenings_normtitle_trgm_idx
  on screenings using gin (normalized_title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 4. Merge log + slug redirects
-- ---------------------------------------------------------------------------
create table if not exists dedupe_log (
  id          bigint generated always as identity primary key,
  merged_at   timestamptz not null default now(),
  kept_id     uuid not null,
  removed_id  uuid not null,
  kept_key    text,
  removed_key text,
  reason      text
);

create table if not exists slug_redirects (
  from_slug  text primary key,
  to_slug    text not null,
  created_at timestamptz not null default now()
);

-- Public read access for the anon key (site reads these at request time).
alter table slug_redirects enable row level security;
do $$
begin
  create policy slug_redirects_read on slug_redirects for select using (true);
exception when duplicate_object then null;
end $$;

alter table title_aliases enable row level security;
do $$
begin
  create policy title_aliases_read on title_aliases for select using (true);
exception when duplicate_object then null;
end $$;

alter table venue_aliases enable row level security;
do $$
begin
  create policy venue_aliases_read on venue_aliases for select using (true);
exception when duplicate_object then null;
end $$;

create table if not exists data_issues (
  id         bigint generated always as identity primary key,
  found_at   timestamptz not null default now(),
  screening_id uuid,
  issue      text not null,
  detail     jsonb
);

-- ---------------------------------------------------------------------------
-- 5. Merge pass (Phase 1.3) — callable repeatedly; second run merges nothing.
--    Finds rows in the same city + date with start times within 30 minutes
--    and similar canonical titles, keeps the most specific row, logs, deletes.
-- ---------------------------------------------------------------------------
create or replace function run_dedupe_merge(similarity_threshold real default 0.55)
returns table (kept uuid, removed uuid, reason text)
language plpgsql
as $$
declare
  pair record;
begin
  for pair in
    select a.id as keep_id, b.id as drop_id,
           format('title sim %.2f (%s ~ %s)',
                  similarity(canonical_title(a.film), canonical_title(b.film)),
                  a.film, b.film) as why
    from screenings a
    join screenings b
      on a.city = b.city
     and a.date = b.date
     and a.id <> b.id
     and a.archived = false and b.archived = false
     and abs(
           coalesce(extract(epoch from a.time::time), 72000) -
           coalesce(extract(epoch from b.time::time), 72000)
         ) <= 1800
     and (
           -- same canonical event
           canonical_title(a.film) = canonical_title(b.film)
        or similarity(canonical_title(a.film), canonical_title(b.film)) >= similarity_threshold
        or b.status = 'film_tbc'
         )
     and (
           canonical_venue(a.venue, a.city) = canonical_venue(b.venue, b.city)
        or canonical_venue(a.venue, a.city) like '%' || canonical_venue(b.venue, b.city) || '%'
        or canonical_venue(b.venue, b.city) like '%' || canonical_venue(a.venue, a.city) || '%'
        or normalize_venue(b.venue) in ('nyc parks', 'new york city parks', 'the luna cinema', 'luna cinema', 'adventure cinema', 'various', 'various venues')
        or normalize_venue(a.venue) in ('nyc parks', 'new york city parks', 'the luna cinema', 'luna cinema', 'adventure cinema', 'various', 'various venues')
         )
     -- keep the more specific row: confirmed beats tbc, named venue beats
     -- umbrella org, richer row beats sparser row, then stable id order
     and (
           (a.status = 'confirmed' and b.status = 'film_tbc')
        or (a.status = b.status and
            (normalize_venue(a.venue) not in ('nyc parks', 'new york city parks', 'the luna cinema', 'luna cinema', 'adventure cinema', 'various', 'various venues')
             and normalize_venue(b.venue) in ('nyc parks', 'new york city parks', 'the luna cinema', 'luna cinema', 'adventure cinema', 'various', 'various venues')))
        or (a.status = b.status
            and (normalize_venue(a.venue) in ('nyc parks','new york city parks','the luna cinema','luna cinema','adventure cinema','various','various venues'))
                = (normalize_venue(b.venue) in ('nyc parks','new york city parks','the luna cinema','luna cinema','adventure cinema','various','various venues'))
            and (coalesce(length(a.image_url),0) + coalesce(length(a.booking_url),0) + coalesce(length(a.address),0),
                 a.id::text)
              > (coalesce(length(b.image_url),0) + coalesce(length(b.booking_url),0) + coalesce(length(b.address),0),
                 b.id::text)
           )
         )
  loop
    insert into dedupe_log (kept_id, removed_id, reason)
    values (pair.keep_id, pair.drop_id, pair.why);
    delete from screenings where id = pair.drop_id;
    kept := pair.keep_id; removed := pair.drop_id; reason := pair.why;
    return next;
  end loop;
end;
$$;

-- Usage:
--   select * from run_dedupe_merge();        -- default threshold 0.55
--   select * from dedupe_log order by merged_at desc limit 50;
