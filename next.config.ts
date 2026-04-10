import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** App root on disk — stabilizes Turbopack when multiple lockfiles exist (local monorepo / CI). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      /** Movie posters (common source for `image_url` in listings) */
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.themoviedb.org",
        pathname: "/**",
      },
      /** Supabase Storage public buckets */
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
