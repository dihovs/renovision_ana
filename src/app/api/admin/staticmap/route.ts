import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/adminAuth";

/**
 * A map of the property, as an image, for the report's cover.
 *
 * **Why the report has one at all.** The reference prints a small map with a
 * pin beside the address on page 1, and it is the right thing to print there:
 * a claim file crosses several desks, and "4489 Rue de Palerme" means nothing
 * to an adjuster three cities away until they can see which building it is
 * and what is around it. It is also the one cover element that cannot be got
 * wrong by a scan.
 *
 * **Why it is proxied.** Google's Static Maps API takes the key in the URL,
 * so putting the URL in an `<img src>` publishes the key to anybody who views
 * source — and the report is a document that gets forwarded. This fetches it
 * server-side and hands back the bytes, so `GOOGLE_MAPS_API_KEY` never leaves
 * the server. Same reasoning, same key, same pattern as `admin/places`.
 *
 * Behind the admin session, because every call is billable and an open
 * endpoint here is somebody else's map on our invoice.
 */

const STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap";

export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "No address" }, { status: 400 });
  }
  if (!key) {
    // Not an error anybody caused, and not worth failing a whole report over.
    // The cover drops the map and prints the address, which is what it did
    // before there was a map at all.
    return NextResponse.json({ error: "Maps not configured" }, { status: 503 });
  }

  const params = new URLSearchParams({
    center: address,
    // Close enough to identify the building, wide enough to show the street
    // it is on — the reference's own framing.
    zoom: "17",
    // 2× for print: the cover box is about 70mm wide, and a 320px image
    // printed at that size is visibly soft next to vector text.
    size: "640x400",
    scale: "2",
    maptype: "roadmap",
    markers: `color:red|${address}`,
    key,
  });

  const upstream = await fetch(`${STATIC_MAP_URL}?${params.toString()}`, {
    // The property does not move. A day of cache saves a billable call every
    // time somebody re-renders the same report.
    next: { revalidate: 86_400 },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Map unavailable (${upstream.status})` },
      { status: 502 },
    );
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
