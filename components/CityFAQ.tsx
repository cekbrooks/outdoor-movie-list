import type { Faq } from "@/lib/city-faq";

/**
 * Visible Q&A block on city pages. Server-rendered, no JS — readable to
 * crawlers and AI agents that don't execute JavaScript. Pairs with FAQPage
 * JSON-LD; the visible text is what most LLMs actually quote.
 */
export function CityFAQ({ cityName, faqs }: { cityName: string; faqs: Faq[] }) {
  if (faqs.length === 0) return null;
  return (
    <section
      aria-labelledby="city-faq-heading"
      className="border-t border-white/10 bg-[#070b14]/40"
    >
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f5a623]/90">
          Common questions
        </p>
        <h2
          id="city-faq-heading"
          className="mt-3 font-display text-3xl font-semibold tracking-tight text-[#f0ede8] md:text-4xl"
        >
          Outdoor movies in {cityName} — answers.
        </h2>
        <div className="mt-10 divide-y divide-white/8">
          {faqs.map((f, i) => (
            <details
              key={f.question}
              className="group py-5 md:py-6"
              open={i === 0}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3 className="font-display text-lg font-semibold tracking-tight text-[#f0ede8] md:text-xl">
                  {f.question}
                </h3>
                <span
                  aria-hidden
                  className="mt-1 shrink-0 rounded-full border border-white/15 px-2 text-sm leading-6 text-white/55 transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/65">
                {f.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
