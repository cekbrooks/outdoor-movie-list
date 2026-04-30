-- Migration 001: source-default columns + relax screenings NOT NULLs.
--
-- Why: n8n scrapers can't reliably extract per-screening geo / accessibility
-- metadata from listing pages. We attach default venue metadata to each
-- single-venue source instead, and let the n8n shape step inherit it. For
-- multi-venue sources (Adventure Cinema, NYC Parks, Rooftop Films NYC) we
-- accept null geo on inserted rows; the UI will hide the map pin.
--
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Relax NOT NULL on screenings columns the scrapers can't fill.
-- ---------------------------------------------------------------------------
alter table screenings alter column address drop not null;
alter table screenings alter column neighbourhood drop not null;
alter table screenings alter column lat drop not null;
alter table screenings alter column lng drop not null;
alter table screenings alter column description drop not null;
alter table screenings alter column booking_url drop not null;
alter table screenings alter column listing_url drop not null;

-- Keep these NOT NULL but give them defaults so n8n payloads can omit them.
alter table screenings alter column outdoor_type set default 'Outdoor';
alter table screenings alter column dog_friendly set default false;
alter table screenings alter column wheelchair_accessible set default false;
alter table screenings alter column byo_food set default false;
alter table screenings alter column film_year set default extract(year from current_date)::int;
alter table screenings alter column host_org set default '';

-- ---------------------------------------------------------------------------
-- 2. Add default columns to sources for single-venue scrapers.
-- ---------------------------------------------------------------------------
alter table sources add column if not exists default_venue text;
alter table sources add column if not exists default_host_org text;
alter table sources add column if not exists default_address text;
alter table sources add column if not exists default_neighbourhood text;
alter table sources add column if not exists default_lat double precision;
alter table sources add column if not exists default_lng double precision;
alter table sources add column if not exists default_outdoor_type text;
alter table sources add column if not exists default_dog_friendly boolean;
alter table sources add column if not exists default_wheelchair_accessible boolean;
alter table sources add column if not exists default_byo_food boolean;

-- ---------------------------------------------------------------------------
-- 3. Add deterministic external_id for upsert idempotency.
--    Format: lowercase(source_name|date|film) — set by the n8n shape step.
-- ---------------------------------------------------------------------------
alter table screenings add column if not exists external_id text;
create unique index if not exists idx_screenings_external_id
  on screenings (external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Backfill source defaults from the seeded screenings.
--    Multi-venue sources are intentionally left null.
-- ---------------------------------------------------------------------------

-- Bryant Park Movie Nights → Bryant Park
update sources set
  default_venue = 'Bryant Park',
  default_host_org = 'Bryant Park Corp / Paramount+',
  default_address = '42nd St & 6th Ave, New York, NY 10018',
  default_neighbourhood = 'Midtown Manhattan',
  default_lat = 40.7536,
  default_lng = -73.9832,
  default_outdoor_type = 'Park',
  default_dog_friendly = false,
  default_wheelchair_accessible = true,
  default_byo_food = true
where name = 'Bryant Park Movie Nights';

-- Movies with a View → Brooklyn Bridge Park - Pier 1
update sources set
  default_venue = 'Brooklyn Bridge Park - Pier 1',
  default_host_org = 'Brooklyn Bridge Park Conservancy',
  default_address = 'Pier 1, Brooklyn, NY 11201',
  default_neighbourhood = 'Brooklyn Heights',
  default_lat = 40.7024,
  default_lng = -73.9968,
  default_outdoor_type = 'Park',
  default_dog_friendly = false,
  default_wheelchair_accessible = true,
  default_byo_food = true
where name = 'Movies with a View - Brooklyn Bridge Park';

-- Rooftop Cinema Club NYC → Embassy Suites rooftop
update sources set
  default_venue = 'Rooftop Cinema Club NYC',
  default_host_org = 'Rooftop Cinema Club',
  default_address = 'Embassy Suites, 60 West 44th St, New York, NY 10036',
  default_neighbourhood = 'Midtown Manhattan',
  default_lat = 40.7553,
  default_lng = -73.9822,
  default_outdoor_type = 'Rooftop',
  default_dog_friendly = false,
  default_wheelchair_accessible = true,
  default_byo_food = false
where name = 'Rooftop Cinema Club NYC';

-- SummerScreen at McCarren Park
update sources set
  default_venue = 'McCarren Park',
  default_host_org = 'L Magazine / DoNYC',
  default_address = 'Lorimer St & Driggs Ave, Brooklyn, NY 11211',
  default_neighbourhood = 'Williamsburg',
  default_lat = 40.7203,
  default_lng = -73.9514,
  default_outdoor_type = 'Park',
  default_dog_friendly = true,
  default_wheelchair_accessible = true,
  default_byo_food = true
where name = 'SummerScreen - McCarren Park';

-- Hudson River Park (RiverFlicks — Pier 63 W 23rd St)
update sources set
  default_venue = 'Hudson River Park - Pier 63',
  default_host_org = 'Hudson River Park Trust',
  default_address = 'Pier 63, Hudson River Greenway, New York, NY 10011',
  default_neighbourhood = 'Chelsea',
  default_lat = 40.7497,
  default_lng = -74.0099,
  default_outdoor_type = 'Pier',
  default_dog_friendly = false,
  default_wheelchair_accessible = true,
  default_byo_food = true
where name = 'Hudson River Park';

-- Vauxhall Summer Screens → Vauxhall Pleasure Gardens
update sources set
  default_venue = 'Vauxhall Pleasure Gardens',
  default_host_org = 'Be in Vauxhall BID',
  default_address = 'Vauxhall Pleasure Gardens, Kennington Ln, London SE11 5HL',
  default_neighbourhood = 'Vauxhall',
  default_lat = 51.4865,
  default_lng = -0.1242,
  default_outdoor_type = 'Park',
  default_dog_friendly = true,
  default_wheelchair_accessible = true,
  default_byo_food = true
where name = 'Vauxhall Summer Screens';

-- Lower Marsh Lates → Lower Marsh, Waterloo
update sources set
  default_venue = 'Lower Marsh',
  default_host_org = 'Lower Marsh Market',
  default_address = 'Lower Marsh, London SE1 7AB',
  default_neighbourhood = 'Waterloo',
  default_lat = 51.5008,
  default_lng = -0.1124,
  default_outdoor_type = 'Street',
  default_dog_friendly = true,
  default_wheelchair_accessible = true,
  default_byo_food = true
where name = 'Lower Marsh Lates';

-- Rooftop Cinema Club Peckham → Bussey Building
update sources set
  default_venue = 'Bussey Building - Rooftop Film Club',
  default_host_org = 'Rooftop Film Club',
  default_address = '133 Rye Lane, Peckham, London SE15 4ST',
  default_neighbourhood = 'Peckham',
  default_lat = 51.4719,
  default_lng = -0.0680,
  default_outdoor_type = 'Rooftop',
  default_dog_friendly = false,
  default_wheelchair_accessible = false,
  default_byo_food = false
where name = 'Rooftop Cinema Club - Peckham (Bussey Building)';

-- Rooftop Cinema Club Stratford → Roof East
update sources set
  default_venue = 'Roof East - Rooftop Film Club',
  default_host_org = 'Rooftop Film Club',
  default_address = 'Roof East, 4th Floor Stratford Centre, London E15 1XB',
  default_neighbourhood = 'Stratford',
  default_lat = 51.5417,
  default_lng = -0.0033,
  default_outdoor_type = 'Rooftop',
  default_dog_friendly = false,
  default_wheelchair_accessible = false,
  default_byo_food = false
where name = 'Rooftop Cinema Club - Stratford (Roof East)';

-- The Open Air Picture House debuts at Eltham Park South 2 May 2026
update sources set
  default_venue = 'Eltham Park South',
  default_host_org = 'The Open Air Picture House',
  default_address = 'Eltham Park South, Glenesk Rd, London SE9 1AB',
  default_neighbourhood = 'Eltham',
  default_lat = 51.4525,
  default_lng = 0.0489,
  default_outdoor_type = 'Park',
  default_dog_friendly = true,
  default_wheelchair_accessible = true,
  default_byo_food = true
where name = 'The Open Air Picture House';

-- Multi-venue sources (Adventure Cinema, NYC Parks, Rooftop Films NYC):
-- left null on purpose. The n8n shape step asks Claude to extract a venue
-- name per screening; geo stays null until we add a venues table.
