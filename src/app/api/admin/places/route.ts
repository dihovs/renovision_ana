import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";

/**
 * Address autocomplete, proxied through the server.
 *
 * Google's own JS widget needs a browser-visible key, which means a second key
 * with HTTP-referrer restrictions and a script tag on every page that touches
 * an address. Proxying instead keeps GOOGLE_MAPS_API_KEY server-side — the same
 * key the reviews pull already uses, on the same Places API (New) that is
 * already enabled — and means no Google script runs in the operator's browser.
 *
 * Behind the admin session because each call is billable. An open endpoint here
 * is somebody else's autocomplete on our invoice.
 */

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

export type PlaceSuggestion = {
  placeId: string;
  /** "1234 Boulevard Saint-Martin" */
  main: string;
  /** "Laval, QC, Canada" */
  secondary: string;
};

export type PlaceDetails = {
  street1: string;
  street2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  googlePlaceId: string;
  latitude: number | null;
  longitude: number | null;
};

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };

function component(components: AddressComponent[], type: string, short = false): string {
  const match = components.find((c) => c.types?.includes(type));
  return (short ? match?.shortText : match?.longText) ?? "";
}

export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    // Not an error the operator caused. The form still works by hand, so this
    // says so rather than looking broken.
    return NextResponse.json({ suggestions: [], unavailable: true });
  }

  const params = new URL(request.url).searchParams;
  const placeId = params.get("placeId");
  // Ties the keystrokes and the final selection into one billable session
  // instead of charging per request.
  const session = params.get("session") ?? undefined;

  try {
    if (placeId) return NextResponse.json(await fetchDetails(placeId, key, session));
    const query = params.get("q")?.trim() ?? "";
    if (query.length < 3) return NextResponse.json({ suggestions: [] });
    return NextResponse.json({ suggestions: await fetchSuggestions(query, key, session) });
  } catch (err) {
    console.error("[places]", err);
    // Degrade to manual entry rather than blocking the save.
    return NextResponse.json({ suggestions: [], unavailable: true });
  }
}

async function fetchSuggestions(
  input: string,
  key: string,
  session?: string,
): Promise<PlaceSuggestion[]> {
  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({
      input,
      // Canada only, and addresses rather than businesses — this field is for
      // "where is the job", so a matching restaurant name is noise.
      includedRegionCodes: ["ca"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      sessionToken: session,
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`autocomplete ${res.status}: ${await res.text()}`);

  const body = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }[];
  };

  return (body.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    return [
      {
        placeId: p.placeId,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      },
    ];
  });
}

async function fetchDetails(placeId: string, key: string, session?: string): Promise<PlaceDetails> {
  const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
  if (session) url.searchParams.set("sessionToken", session);

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      // Only the fields we store. The field mask is what Google bills on, so
      // asking for everything costs real money for data we discard.
      "X-Goog-FieldMask": "id,addressComponents,location",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`details ${res.status}: ${await res.text()}`);

  const body = (await res.json()) as {
    id?: string;
    addressComponents?: AddressComponent[];
    location?: { latitude?: number; longitude?: number };
  };

  const parts = body.addressComponents ?? [];
  const streetNumber = component(parts, "street_number");
  const route = component(parts, "route");

  return {
    street1: [streetNumber, route].filter(Boolean).join(" "),
    // Apartment or unit, when Google knows it.
    street2: component(parts, "subpremise"),
    // Montreal boroughs come back as sublocality with no locality, so fall
    // through rather than leaving the city blank on a valid address.
    city:
      component(parts, "locality") ||
      component(parts, "sublocality") ||
      component(parts, "administrative_area_level_2"),
    province: component(parts, "administrative_area_level_1", true),
    postalCode: component(parts, "postal_code"),
    country: component(parts, "country"),
    googlePlaceId: body.id ?? placeId,
    latitude: body.location?.latitude ?? null,
    longitude: body.location?.longitude ?? null,
  };
}
