import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ScreeningCard } from "@/components/ScreeningCard";
import {
  getFilmMetaFromSlug,
  getScreeningsByFilmSlug,
  sortScreeningsByDate,
} from "@/lib/queries";
import { defaultOgImage, SITE_NAME, SITE_URL } from "@/lib/seo";
import { eventsJsonLdArray } from "@/lib/jsonld";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = getFilmMetaFromSlug(slug);
  const rows = getScreeningsByFilmSlug(slug);
  const first = rows[0];
  if (!meta || !first) return { title: "Film not found" };
  const title = `${meta.film} (${meta.filmYear}) — Outdoor screenings — ${SITE_NAME}`;
  const description = first.description.slice(0, 160);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/movies/${slug}`,
      images: [
        {
          url: first.imageUrl || defaultOgImage,
          width: 1200,
          height: 630,
          alt: meta.film,
        },
      ],
    },
  };
}

export default async function FilmPage({ params }: Props) {
  const { slug } = await params;
  const rows = getScreeningsByFilmSlug(slug).sort(sortScreeningsByDate);
  if (rows.length === 0) notFound();

  const meta = getFilmMetaFromSlug(slug)!;
  const first = rows[0];
  const jsonLd = eventsJsonLdArray(rows);

  return (
    <main className="flex-1">
      <JsonLd data={jsonLd} />
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <Link href="/" className="text-sm text-[#f5a623] hover:underline">
            ← Home
          </Link>
          <div className="mt-6 flex flex-col gap-8 md:flex-row md:items-start">
            <div className="relative mx-auto aspect-[2/3] w-full max-w-[240px] shrink-0 overflow-hidden rounded-2xl border border-white/10 md:mx-0">
              <Image
                src={first.imageUrl}
                alt={`${meta.film} poster`}
                fill
                className="object-cover"
                sizes="240px"
                priority
              />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
                {meta.film}{" "}
                <span className="text-xl font-normal text-white/45">
                  ({meta.filmYear})
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-white/65">
                {first.description}
              </p>
              <p className="mt-6 text-sm text-white/45">
                {rows.length} outdoor{" "}
                {rows.length === 1 ? "screening" : "screenings"} across our
                cities.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:pb-20">
        <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
          Where it&apos;s playing
        </h2>
        <ul className="mt-8 grid list-none gap-6 p-0">
          {rows.map((s) => (
            <li key={s.id}>
              <ScreeningCard screening={s} showCity />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
