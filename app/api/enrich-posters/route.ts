import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const TMDB_KEY = process.env.TMDB_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const resend = new Resend(process.env.RESEND_API_KEY);

const SKIP_TERMS = ['tbc', 'various', 'rolling', 'tba', 'to be'];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/screenings?select=id,film,film_year,city_name&image_url=is.null&archived=is.false`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const screenings = await res.json();

  const toProcess = screenings.filter((s: any) =>
    s.film &&
    !SKIP_TERMS.some(t => s.film.toLowerCase().includes(t)) &&
    s.film.trim().length > 2
  );

  const updated: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const s of toProcess) {
    try {
      const query = encodeURIComponent(s.film.replace(/sing-along/i, '').trim());
      const year = s.film_year ? `&year=${s.film_year}` : '';
      const tmdbRes = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}${year}&language=en-US&page=1`
      );
      const tmdbData = await tmdbRes.json();
      const movie = tmdbData.results?.[0];

      if (!movie?.poster_path) {
        skipped.push(`${s.film} (${s.city_name})`);
        continue;
      }

      const imageUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;

      await fetch(`${SUPABASE_URL}/rest/v1/screenings?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      updated.push(`${s.film} (${s.city_name})`);
      await new Promise(r => setTimeout(r, 200));
    } catch {
      failed.push(`${s.film} (${s.city_name})`);
    }
  }

  // Send summary email
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hasActivity = updated.length > 0 || skipped.length > 0 || failed.length > 0;

  await resend.emails.send({
    from: 'Outdoor Movie List <onboarding@resend.dev>',
    to: process.env.CRON_NOTIFY_EMAIL!,
    subject: `OML Daily Update — ${date}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #f5a623;">🎬 Outdoor Movie List — Daily Poster Update</h2>
        <p style="color: #666;">${date}</p>

        ${!hasActivity ? `<p>Nothing to process today — all screenings already have posters or no new films were added.</p>` : ''}

        ${updated.length > 0 ? `
          <h3 style="color: #22c55e;">✅ Posters added (${updated.length})</h3>
          <ul>${updated.map(f => `<li>${f}</li>`).join('')}</ul>
        ` : ''}

        ${skipped.length > 0 ? `
          <h3 style="color: #f59e0b;">⚠️ No poster found (${skipped.length})</h3>
          <ul>${skipped.map(f => `<li>${f}</li>`).join('')}</ul>
        ` : ''}

        ${failed.length > 0 ? `
          <h3 style="color: #ef4444;">❌ Errors (${failed.length})</h3>
          <ul>${failed.map(f => `<li>${f}</li>`).join('')}</ul>
        ` : ''}

        <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">Sent automatically by the Outdoor Movie List cron job.</p>
      </div>
    `
  });

  return NextResponse.json({ success: true, processed: toProcess.length, updated: updated.length, skipped: skipped.length, failed: failed.length });
}
