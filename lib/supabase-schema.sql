-- Supabase-ready schema for Outdoor Movie List (reference; not applied by the app)

create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  country text not null,
  lat double precision not null,
  lng double precision not null,
  added_by text,
  added_date date,
  created_at timestamptz default now()
);

create table if not exists screenings (
  id text primary key,
  city_slug text not null references cities (slug),
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
  screening_date date not null,
  screening_time text not null,
  price text not null,
  is_free boolean not null default false,
  outdoor_type text not null,
  dog_friendly boolean not null default false,
  wheelchair_accessible boolean not null default false,
  byo_food boolean not null default false,
  booking_url text not null,
  listing_url text not null,
  image_url text not null,
  added_by text,
  status text not null check (status in ('confirmed', 'tbc')),
  created_at timestamptz default now()
);

create index if not exists idx_screenings_city_date on screenings (city_slug, screening_date);

create table if not exists email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  city_preference text,
  created_at timestamptz default now()
);

create table if not exists city_suggestions (
  id uuid primary key default gen_random_uuid(),
  city_name text not null,
  submitter_name text not null,
  submitter_email text,
  created_at timestamptz default now()
);
