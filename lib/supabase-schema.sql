-- Reference schema for the Outdoor Movie List Supabase project.
--
-- This file mirrors the live `public` schema (verified via PostgREST
-- introspection). It is a reference document — the app does not apply it.
-- If you change the live schema, update this file in the same PR.

-- ---------------------------------------------------------------------------
-- cities
-- ---------------------------------------------------------------------------
create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  country text not null,
  lat double precision not null,
  lng double precision not null,
  added_by text,
  added_date timestamptz,
  screening_count int not null default 0
);

-- ---------------------------------------------------------------------------
-- screenings
--
-- Live columns use short names: `city` (slug FK), `date`, `time`.
-- A previous draft of this file used `city_slug` / `screening_date` /
-- `screening_time` — those columns do not exist in the live table.
-- ---------------------------------------------------------------------------
create table if not exists screenings (
  id uuid primary key default gen_random_uuid(),
  city text not null references cities (slug),
  city_name text not null,
  venue text not null,
  host_org text not null,
  address text not null,
  neighbourhood text not null,
  lat double precision not null,
  lng double precision not null,
  film text not null,
  film_year int not null,
  description text not null,
  date date not null,
  time text not null,
  price text not null,
  is_free boolean not null default false,
  outdoor_type text not null,
  dog_friendly boolean not null default false,
  wheelchair_accessible boolean not null default false,
  byo_food boolean not null default false,
  booking_url text not null,
  listing_url text not null,
  image_url text,
  added_by text,
  status text not null check (status in ('confirmed', 'tbc')),
  archived boolean not null default false,
  tmdb_id int,
  created_at timestamptz not null default now(),
  unique (city, venue, date, film)
);

create index if not exists idx_screenings_city_date on screenings (city, date);
create index if not exists idx_screenings_archived on screenings (archived);

-- ---------------------------------------------------------------------------
-- sources
--
-- Scraping sources consumed by n8n. `scraper_type` selects the parser;
-- `last_scraped` is updated by n8n on each successful run and read by the
-- daily-update cron for the source-health table in the diff email.
-- ---------------------------------------------------------------------------
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  city text not null references cities (slug),
  name text not null,
  url text not null,
  scraper_type text not null,
  active boolean not null default true,
  last_scraped timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sources_active on sources (active);

-- ---------------------------------------------------------------------------
-- city_suggestions
-- ---------------------------------------------------------------------------
create table if not exists city_suggestions (
  id uuid primary key default gen_random_uuid(),
  city_name text not null,
  suggested_by_name text not null,
  suggested_by_email text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
