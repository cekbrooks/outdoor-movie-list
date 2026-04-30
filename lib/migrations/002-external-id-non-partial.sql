-- Migration 002: replace the partial unique index on screenings.external_id
-- with a non-partial one so PostgREST accepts on_conflict=external_id.
--
-- Postgres allows multiple NULLs under a unique constraint by default; the
-- partial WHERE clause was unnecessary AND blocked PostgREST upserts.

drop index if exists idx_screenings_external_id;

create unique index idx_screenings_external_id
  on screenings (external_id);
