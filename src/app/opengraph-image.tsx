import { ImageResponse } from "next/og";

// Root OG image (file convention) — every route without a more specific
// opengraph-image inherits it, which finally gives twitter:card=
// summary_large_image (declared sitewide in buildMetadata) an actual image.
// System font on purpose: loading brand webfonts into satori is fragile, and
// a clean bold sans in brand colors reads correctly at card size.

export const alt =
  "Renovision AnA — Rénovation & restauration de dégâts d'eau — Laval & Montréal";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Brand palette from globals.css (satori can't read CSS variables).
const BRAND_BLUE_DARK = "#1f4677";
const BRAND_BLUE = "#2b5c9e";
const BRAND_GREEN_SOFT = "#6fbf4c";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${BRAND_BLUE_DARK} 0%, ${BRAND_BLUE} 100%)`,
          fontFamily:
            'ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: -2,
            color: "#ffffff",
          }}
        >
          <span>Renovision</span>
          <span style={{ color: BRAND_GREEN_SOFT, marginLeft: 28 }}>AnA</span>
        </div>
        <div
          style={{
            marginTop: 28,
            width: 120,
            height: 6,
            borderRadius: 3,
            background: BRAND_GREEN_SOFT,
          }}
        />
        <div
          style={{
            marginTop: 32,
            fontSize: 34,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            textAlign: "center",
            maxWidth: 980,
          }}
        >
          Rénovation &amp; restauration de dégâts d&apos;eau — Laval &amp; Montréal
        </div>
      </div>
    ),
    { ...size },
  );
}
