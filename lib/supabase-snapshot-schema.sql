-- Snapshot table for the daily-update cron.
-- Stores a per-day snapshot of upcoming screenings so the next run can diff
-- against it (new / removed / edited) without modifying the screenings table.

create table if not exists screenings_snapshot (
  snapshot_date date primary key,
  -- payload is an array of { id, city, venue, date, time, film, status }
  -- (only the fields needed for diffing — keeps the row small)
  payload jsonb not null,
  row_count int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_screenings_snapshot_created
  on screenings_snapshot (created_at desc);

-- Optional: prune snapshots older than 30 days (uncomment if desired)
-- delete from screenings_snapshot where snapshot_date < current_date - interval '30 days';
