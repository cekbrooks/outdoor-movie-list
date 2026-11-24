import type { MetadataRoute } from "next";

const ORIGIN = "https://outdoormovielist.com";

/**
 * Search engines and AI assistants are all welcome: the listings are public
 * and the whole point is to be found. The AI crawlers are named explicitly so
 * a blanket rule added later for "*" can't shut them out by accident.
 */
const AI_AND_SEARCH_BOTS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Applebot",
  "Applebot-Extended",
  "Google-Extended",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
  "MistralAI-User",
  "cohere-ai",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  // API routes are machinery, except /api/og which serves share images.
  const shared = {
    allow: ["/", "/api/og"],
    disallow: ["/api/"],
  };
  return {
    rules: [
      { userAgent: AI_AND_SEARCH_BOTS, ...shared },
      { userAgent: "*", ...shared },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
