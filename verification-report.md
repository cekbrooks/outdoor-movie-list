# Source verification report — final

Generated 2026-04-29 (after all fixes applied)

## Final tally

**13 active sources · 10 GOOD · 3 THIN · 0 BROKEN**

Up from 4 GOOD on the first pass.

## Step 1 — Data fixes applied

| Operation | Target | Result |
| --- | --- | --- |
| DELETE | Eltham Park | applied |
| DELETE | Screen on the Green | applied |
| DELETE | Fulham Palace | applied |
| UPDATE | Vauxhall Summer Screens → `beinvauxhall.com/article/vauxhall-summer-2025/` | applied (then superseded — see below) |
| UPDATE | Hudson River Park → `hudsonriverpark.org/visit/events/` | applied |
| UPDATE | Movies with a View - Brooklyn Bridge Park → `brooklynbridgepark.org/events/movies-with-a-view/` | applied |

## Follow-on URL fixes applied during verification

| Source | Old URL | New URL | Why |
| --- | --- | --- | --- |
| NYC Parks - Free Outdoor Movies | `nycgovparks.org/events/free-outdoor-movies` | `nycgovparks.org/events/free_summer_movies` | Old slug 403'd through Jina; new slug returns the 2026 schedule (50+ date matches) |
| SummerScreen - Prospect Park | `prospectpark.org/events/` (a 2022 archive) | `donyc.com/summer-screen` (and renamed to **SummerScreen - McCarren Park**) | SummerScreen runs at McCarren, not Prospect; SummerScreen's own site 404'd on every variant tried, DoNYC has the 2026 schedule |
| Vauxhall Summer Screens | `beinvauxhall.com/article/vauxhall-summer-2025/` (2025 recap) | `timeout.com/london/things-to-do/vauxhall-summer-screens` | Time Out's evergreen listing has the 2026 lineup (3 films, 14 dates) |
| Rooftop Cinema Club - Peckham (Bussey Building) | `rooftopcinemaclub.com/uk/london/rooftop-cinema-club-peckham` | `timeout.com/london/film/rooftop-film-club-peckham-rye` | Original URL is a JS-rendered venue page (zero schedule data in plaintext); Time Out's listing surfaces the schedule |
| Rooftop Cinema Club - Stratford (Roof East) | `rooftopcinemaclub.com/uk/london/rooftop-cinema-club-stratford` | `timeout.com/london/film/rooftop-film-club-stratford` | Same JS-rendered chrome problem; Time Out works |
| Rooftop Cinema Club NYC | `rooftopcinemaclub.com/new-york/` (brand chooser) | `donyc.com/venues/rooftop-cinema-club-midtown` | Original was the US-wide venue selector; DoNYC has the Midtown schedule |

## Final results table

| Name | City | Status | Size | Notes |
| --- | --- | --- | --- | --- |
| Adventure Cinema | london | GOOD | 14.9kb | 95 dates, 48 times, 2026 |
| Lower Marsh Lates | london | GOOD | 26.5kb | 10 dates, 13 times, 2026 |
| Vauxhall Summer Screens | london | GOOD | 30.9kb | 14 dates, 1 time, 2026 |
| Rooftop Cinema Club - Peckham (Bussey Building) | london | GOOD | 26.1kb | 7 dates, 2026 (via Time Out) |
| Rooftop Cinema Club - Stratford (Roof East) | london | GOOD | 28.9kb | 7 dates, 2026 (via Time Out) |
| The Open Air Picture House | london | THIN | 6.5kb | Eventbrite organizer page; only 1 event posted (Mrs Doubtfire, 2 May at Eltham Park). Recheck after they list more. URL is correct. |
| Movies with a View - Brooklyn Bridge Park | new-york | GOOD | 23.0kb | 14 dates, 31 times, 2026 |
| Rooftop Films NYC | new-york | GOOD | 3.1kb | 11 dates, 13 times, 2026 |
| NYC Parks - Free Outdoor Movies | new-york | GOOD | 28.2kb | 50 date matches, 2026 |
| SummerScreen - McCarren Park | new-york | GOOD | 18.4kb | 2 dates, 2026 (via DoNYC) |
| Rooftop Cinema Club NYC | new-york | GOOD | 19.6kb | 13 dates, 2026 (via DoNYC) |
| Bryant Park Movie Nights | new-york | THIN | 6.6kb | URL is correct but schedule is JS-rendered; Jina sees the cookie banner only. Recheck mid-May when the lineup is announced; may need an iCal feed for n8n to parse. |
| Hudson River Park | new-york | THIN | 5.6kb | URL is correct; events page mixes art/science/film events. RiverFlicks (Wed at Pier 63, Fri at Pier 46) typically launches in late June. Recheck then. |

## Things to keep an eye on

- **Aggregator URLs** (Time Out, DoNYC) for the rooftops and Vauxhall: these reflect what the venue feeds them. Cross-check against the venue site at the start and middle of the season.
- **Bryant Park** still THIN — if the schedule doesn't appear in Jina output by mid-May, switch to their iCal endpoint. The page exists but is rendered client-side.
- **Hudson River Park** events page lists all event types. n8n's parser will need to filter by the "RiverFlicks" or "Movie" tag, or you can swap to a dedicated RiverFlicks landing page once they publish one for 2026.
- **The Open Air Picture House** is brand new (debuts 2 May at Eltham Park). Eventbrite organizer URL is correct; expect more events to appear over the season.

## Scripts used

- `scripts/verify-sources.mjs` — initial fixes + verification report
- `scripts/fix-nyc-parks.mjs` — NYC Parks slug fix
- `scripts/apply-broken-fixes.mjs` — first-pass URL fixes for the five remaining BROKEN sources
- `scripts/probe-and-finalize.mjs` — multi-candidate probe; fixed SummerScreen
- `scripts/apply-rooftop-fixes.mjs` — final rooftop URL swap to evergreen aggregator pages
