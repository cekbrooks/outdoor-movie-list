import { NextResponse } from 'next/server';

const TMDB_KEY = process.env.TMDB_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
      if (!movie?.poster_path) { skipped.push(`${s.film} (${s.city_name})`); continue; }
      const imageUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
      await fetch(`${SUPABASE_URL}/rest/v1/screenings?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ image_url: imageUrl })
      });
      updated.push(`${s.film} (${s.city_name})`);
      await new Promise(r => setTimeout(r, 200));
    } catch { failed.push(s.film); }
  }

}
