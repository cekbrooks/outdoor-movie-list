import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Per-page OpenGraph images (Fix Brief 3.4). Replaces the generic Unsplash
 * photo everywhere.
 *
 *   /api/og?title=…&subtitle=…            branded card (home/city/period)
 *   /api/og?title=…&subtitle=…&img=…      poster composite (movie/venue)
 *   …&badge=Free                          gold corner badge
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const title = (sp.get("title") || "Outdoor Movie List").slice(0, 90);
  const subtitle = (sp.get("subtitle") || "").slice(0, 120);
  const img = sp.get("img") || "";
  const badge = (sp.get("badge") || "").slice(0, 20);

  const allowedImg =
    img.startsWith("https://image.tmdb.org/") ||
    img.startsWith("https://images.unsplash.com/")
      ? img
      : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0a0f1e",
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(245,166,35,0.25), transparent)",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            paddingRight: allowedImg ? 40 : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: "#f5a623",
                display: "flex",
              }}
            />
            <div
              style={{
                color: "#f5a623",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Outdoor Movie List
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                color: "#f0ede8",
                fontSize: title.length > 50 ? 52 : 64,
                fontWeight: 700,
                lineHeight: 1.1,
                display: "flex",
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div
                style={{
                  color: "rgba(240,237,232,0.65)",
                  fontSize: 30,
                  marginTop: 24,
                  lineHeight: 1.3,
                  display: "flex",
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>

          <div
            style={{
              color: "rgba(240,237,232,0.45)",
              fontSize: 24,
              display: "flex",
            }}
          >
            outdoormovielist.com
          </div>
        </div>

        {allowedImg ? (
          <div
            style={{
              display: "flex",
              width: 300,
              height: 450,
              borderRadius: 24,
              overflow: "hidden",
              border: "2px solid rgba(245,166,35,0.4)",
              alignSelf: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={allowedImg}
              alt=""
              width={300}
              height={450}
              style={{ objectFit: "cover", width: 300, height: 450 }}
            />
          </div>
        ) : null}

        {badge ? (
          <div
            style={{
              position: "absolute",
              top: 48,
              right: 60,
              backgroundColor: "#f5a623",
              color: "#0a0f1e",
              fontSize: 28,
              fontWeight: 700,
              padding: "10px 28px",
              borderRadius: 999,
              display: "flex",
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    }
  );
}
