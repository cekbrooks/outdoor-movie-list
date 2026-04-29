This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Daily update cron

`/api/cron/daily-update` runs once a day (07:00 UTC, configured in
`vercel.json`). It diffs the current contents of the `screenings` table
against yesterday's snapshot in `screenings_snapshot` and emails the
result to `CRON_NOTIFY_EMAIL` via Resend.

**One-time setup**

1. Apply the snapshot migration:
   ```sql
   -- in Supabase SQL Editor, run lib/supabase-snapshot-schema.sql
   ```
2. Add these to Vercel project env (Production + Preview):
   - `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS for server-side writes
   - `CRON_SECRET` — `openssl rand -hex 32`
   - `CRON_NOTIFY_EMAIL` — recipient
   - `CRON_FROM_EMAIL` (optional) — sender, must be verified in Resend
   - `RESEND_API_KEY` — Resend API key
   - `N8N_TRIGGER_URL` (optional) — POSTed before the diff if set
   - `N8N_TRIGGER_AUTH` (optional) — sent as the Authorization header
   - `N8N_WAIT_MS` (optional) — pause after the n8n POST before diffing

**Sending domain.** Resend requires the `from` address's domain to be
verified. The default sender is `noreply@outdoormovielist.com`; verify
that domain in Resend, or override `CRON_FROM_EMAIL` to use a domain
that is verified.

**Manual test**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://outdoormovielist.com/api/cron/daily-update
```

The first run sees no prior snapshot, so it sends a "first daily run"
email and stores today's snapshot. From the second run onward, the email
shows new / removed / edited screenings.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
