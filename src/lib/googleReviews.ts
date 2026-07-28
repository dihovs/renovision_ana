import { SITE_ADDRESS, SITE_NAME } from "@/lib/constants";

export type GoogleReviewItem = { name: string; rating: number; quote: string };

export type GoogleReviewsData = {
  items: GoogleReviewItem[];
  overallRating: number | null;
  reviewCount: number | null;
};

// Real aggregate read directly off the business's public Google listing on
// 2026-07-27 (5.0 stars, 15 ratings). Used only when the live pull isn't
// available — the moment the Places API starts responding, its numbers win.
// Update this by hand if the live pull stays disabled and the count moves.
const FALLBACK_OVERALL_RATING = 5.0;
const FALLBACK_REVIEW_COUNT = 15;

// `items` stays empty on purpose: callers fall back to their own curated set
// of real review text. Only the aggregate is filled in here.
const EMPTY: GoogleReviewsData = {
  items: [],
  overallRating: FALLBACK_OVERALL_RATING,
  reviewCount: FALLBACK_REVIEW_COUNT,
};

// Google's Places API has no cron of its own — this just re-checks on the
// first request after the cache goes stale, which for a fetch this cheap and
// this rarely-changing amounts to "about once a week," per the owner's ask.
const REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

async function resolvePlaceId(apiKey: string): Promise<string | null> {
  const address = `${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.addressLocality}, ${SITE_ADDRESS.addressRegion}, Canada`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery: `${SITE_NAME}, ${address}` }),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    console.error("[google-reviews] place search failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { places?: { id: string }[] };
  return data.places?.[0]?.id ?? null;
}

/**
 * Pulls five-star Google reviews for the testimonials section, plus the
 * business's real overall rating — shown separately, since Google expects a
 * page featuring hand-picked reviews to still surface the true aggregate
 * rather than implying the average is 5.0. Refreshes weekly (see
 * REVALIDATE_SECONDS); falls back to an empty result — callers keep their
 * own static reviews — if the key/API isn't set up, or the call fails.
 */
export async function getGoogleReviewsData(): Promise<GoogleReviewsData> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return EMPTY;

  try {
    const placeId = await resolvePlaceId(apiKey);
    if (!placeId) return EMPTY;

    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount,reviews",
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error("[google-reviews] place details failed:", res.status, await res.text().catch(() => ""));
      return EMPTY;
    }

    const data = (await res.json()) as {
      rating?: number;
      userRatingCount?: number;
      reviews?: {
        rating?: number;
        text?: { text?: string };
        authorAttribution?: { displayName?: string };
      }[];
    };

    const items = (data.reviews ?? [])
      .filter(
        (r): r is { rating: number; text: { text: string }; authorAttribution: { displayName: string } } =>
          r.rating === 5 && !!r.text?.text && !!r.authorAttribution?.displayName,
      )
      .map((r) => ({ name: r.authorAttribution.displayName, rating: 5, quote: r.text.text }));

    return {
      items,
      overallRating: data.rating ?? null,
      reviewCount: data.userRatingCount ?? null,
    };
  } catch (err) {
    console.error("[google-reviews] request failed:", err);
    return EMPTY;
  }
}
