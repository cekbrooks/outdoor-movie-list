import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import { defaultOgImage, getMetadataBase, SITE_NAME } from "@/lib/seo";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: `${SITE_NAME} — Outdoor cinema & open-air movies worldwide`,
    template: `%s`,
  },
  description:
    "Discover outdoor movie screenings in parks, rooftops, and waterfronts. New York, London, and more cities coming soon.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description:
      "Every outdoor movie. Every city. All summer. Parks, rooftops, drive-ins, and gardens.",
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Discover outdoor movie screenings in cities around the world.",
    images: [defaultOgImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0f1e] text-[#f0ede8]">
        <Navigation />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
