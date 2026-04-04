import Image from "next/image";
import Link from "next/link";
import type { Screening } from "@/lib/types";
import { filmSlug, venueSlug } from "@/lib/queries";

type Props = {
  screening: Screening;
  showCity?: boolean;
  className?: string;
};

export function ScreeningCard({
  screening: s,
  showCity,
  className = "",
}: Props) {
  const vSlug = venueSlug(s.venue);
  const fSlug = filmSlug(s.film, s.filmYear);

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1428]/90 shadow-lg shadow-black/40 transition duration-300 hover:-translate-y-1 hover:border-[#f5a623]/40 hover:shadow-[0_0_40px_-10px_rgba(245,166,35,0.35)] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative flex flex-col sm:flex-row">
        <Link
          href={`/movies/${fSlug}`}
          className="relative aspect-[2/3] w-full shrink-0 sm:w-36 md:w-44"
        >
          <Image
            src={s.imageUrl}
            alt={`${s.film} poster`}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="(max-width:640px) 100vw, 176px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e]/90 via-transparent to-transparent sm:bg-gradient-to-r" />
        </Link>
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-xl font-semibold tracking-tight text-[#f0ede8] md:text-2xl">
                <Link
                  href={`/movies/${fSlug}`}
                  className="hover:text-[#f5a623] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
                >
                  {s.film}
                </Link>
                <span className="ml-2 text-base font-normal text-white/50">
                  ({s.filmYear})
                </span>
              </h3>
              <p className="mt-1 text-sm text-[#f0ede8]/75">
                <Link
                  href={`/venues/${vSlug}`}
                  className="hover:text-[#f5a623] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
                >
                  {s.venue}
                </Link>
                {showCity ? (
                  <span className="text-white/40">
                    {" "}
                    · {s.cityName}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  s.isFree
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "bg-[#f5a623]/15 text-[#f5a623] ring-1 ring-[#f5a623]/35"
                }`}
              >
                {s.price}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-[#f0ede8]/80 ring-1 ring-white/10">
                {s.outdoorType}
              </span>
              {s.dogFriendly ? (
                <span
                  className="rounded-full bg-white/5 px-2 py-1 text-xs text-[#f0ede8]/90 ring-1 ring-white/10"
                  title="Dog friendly"
                >
                  Dog friendly
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
            <time dateTime={s.date}>
              {new Date(s.date + "T12:00:00").toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
            <span>{s.time}</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-[#f0ede8]/70 ring-1 ring-white/10">
              {s.neighbourhood}
            </span>
          </div>
          {s.status === "tbc" ? (
            <p className="text-xs font-medium uppercase tracking-wider text-amber-200/80">
              Date to be confirmed
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap gap-3 pt-1">
            <a
              href={s.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-[#f5a623] px-5 py-2.5 text-sm font-semibold text-[#0a0f1e] transition hover:bg-[#ffc04d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
            >
              Book / More info
            </a>
            <a
              href={s.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-white/50 underline-offset-4 hover:text-[#f5a623] hover:underline"
            >
              Listing
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
