import { SITE_NAME } from "@/lib/constants";

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

/**
 * The business's real Google Place ID, verified 2026-07-28 against the live
 * API (returns "Renovision AnA", 5.0, 15 ratings).
 *
 * This is pinned rather than resolved by text search, and that matters. The
 * previous version searched `places:searchText` for the business name plus
 * the street address and took the first hit — but the Google profile is a
 * service-area business with no public street address, so that search never
 * matched it. Once the API was enabled the top result came back as a nearby
 * competitor, which would have published a competitor's rating and reviews on
 * this site. Pinning the ID removes that failure mode entirely, and skips a
 * billed API call per refresh.
 */
const PLACE_ID = "ChIJrzwHvK8U16oRCX0SicFiAek";

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
    const res = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=en`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews",
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error("[google-reviews] place details failed:", res.status, await res.text().catch(() => ""));
      return EMPTY;
    }

    const data = (await res.json()) as {
      displayName?: { text?: string };
      rating?: number;
      userRatingCount?: number;
      reviews?: {
        rating?: number;
        text?: { text?: string };
        authorAttribution?: { displayName?: string };
      }[];
    };

    // Refuse to publish anything unless the place we fetched is actually this
    // business. Cheap insurance against a mistyped or stale PLACE_ID quietly
    // putting another company's rating and reviews on the site — the exact
    // failure the old text-search lookup produced.
    if (data.displayName?.text !== SITE_NAME) {
      console.error(
        `[google-reviews] place ${PLACE_ID} resolved to "${data.displayName?.text ?? "unknown"}", expected "${SITE_NAME}" — ignoring.`,
      );
      return EMPTY;
    }

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
