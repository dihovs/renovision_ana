import { NextResponse } from "next/server";
import { SITE_ADDRESS } from "@/lib/constants";
import { calculateTripFee } from "@/lib/tripFee";

export const runtime = "nodejs";

// Basic Canadian postal code shape (e.g. "H7N 2A3") — just enough to reject
// junk input before spending a Google Maps API call on it.
const POSTAL_CODE_RE = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

const ORIGIN_ADDRESS = `${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.addressLocality}, ${SITE_ADDRESS.addressRegion}, Canada`;

type DistanceMatrixResponse = {
  status: string;
  rows?: {
    elements: {
      status: string;
      distance?: { value: number };
      duration?: { value: number };
      duration_in_traffic?: { value: number };
    }[];
  }[];
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { postalCode?: string } | null;
  const postalCode = body?.postalCode?.trim() ?? "";

  if (!POSTAL_CODE_RE.test(postalCode)) {
    return NextResponse.json({ ok: false, reason: "invalid_postal_code" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Same graceful-degrade convention as the other optional integrations in
    // this app (RESEND_API_KEY, ANTHROPIC_API_KEY): missing config is not a
    // 500, it's just "this feature isn't turned on yet."
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 200 });
  }

  const params = new URLSearchParams({
    units: "metric",
    origins: ORIGIN_ADDRESS,
    destinations: `${postalCode}, Canada`,
    departure_time: "now",
    traffic_model: "best_guess",
    key: apiKey,
  });

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`);
    const data = (await res.json()) as DistanceMatrixResponse;

    const element = data.rows?.[0]?.elements?.[0];
    if (data.status !== "OK" || !element || element.status !== "OK" || !element.distance || !element.duration) {
      return NextResponse.json({ ok: false, reason: "no_route" }, { status: 200 });
    }

    const result = calculateTripFee({
      distanceMeters: element.distance.value,
      freeFlowSeconds: element.duration.value,
      // duration_in_traffic can be absent (e.g. transit data gaps) — fall back
      // to the free-flow time, which is a 1.0x multiplier (no traffic charge).
      trafficSeconds: element.duration_in_traffic?.value ?? element.duration.value,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[trip-fee] Google Distance Matrix request failed:", err);
    return NextResponse.json({ ok: false, reason: "request_failed" }, { status: 200 });
  }
}
