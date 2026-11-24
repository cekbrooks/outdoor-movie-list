-- Migration 004: columns the add-a-city sweep needs.
--
-- The n8n "OML City Sweep" workflow creates a cities row when someone
-- requests a new city. The site needs each city's time zone (to decide what
-- counts as "upcoming") and currency (for event JSON-LD). Both were
-- hard-coded for New York and London; they now live on the row, with the
-- old hard-coded values kept as a fallback in lib/dates.ts.
--
-- Optional: the sweep and the site both work before this runs. Until it
-- does, swept cities fall back to UTC and USD.
--
-- Idempotent: safe to re-run.

alter table cities add column if not exists timezone text;
alter table cities add column if not exists currency text;
alter table cities add column if not exists country_code text;

update cities set timezone = 'America/New_York', currency = 'USD', country_code = 'US'
where slug = 'new-york' and timezone is null;

update cities set timezone = 'Europe/London', currency = 'GBP', country_code = 'GB'
where slug = 'london' and timezone is null;
