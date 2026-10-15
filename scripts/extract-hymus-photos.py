#!/usr/bin/env python3
"""Pull the site photographs out of Polygon's devis for SDC H1 Phase 3
(122 boul. Hymus, Pointe-Claire) — estimate 1641745-SDC-H1, 8 Oct 2026.

    python3 scripts/extract-hymus-photos.py "/path/to/1641745 - SDC H1 Phase 3 - devis - avec photos.pdf"

Writes `/tmp/hymus-photos/<room-id>-<n>.jpg` plus a `manifest.json`, which
`src/components/admin/hymus-report.render.test.tsx` inlines into our report.

**Which room a photograph belongs to is read off its caption, not guessed.**
Polygon prints one photograph per page with a caption such as
`2  Unit 302/Aire ouverte / cuisine - 2-IMG_0025  Date prise : 2026-09-15`.
The PDF has no text layer (it went through "Microsoft: Print To PDF"), so the
captions were read with Apple's on-device text recognition (Vision) on
14 Oct 2026, and the result is the table below — page number → room:

    p15            Unit 302 (the unit's door, no room)
    p16–p42        Unit 302 / Aire ouverte / cuisine
    p43            Unit 202 (door)
    p44–p59        Unit 202 / Aire ouverte / cuisine
    p60–p62        Unit 202 / Salle de lavage
    p63            Unit 102 (door)
    p64–p68        Unit 102 / Salle de lavage
    p69–p86        Unit 102 / Salle de bains

The three door photographs are filed under each unit's open area: that is the
room the entrance door opens into on the sketch, and `ReportRoom` only carries
photographs on a room.

**Three photographs are left out on purpose:** p55 (someone's legs) and p81,
p82 (the other firm's estimator reflected in the bathroom mirror). A report we
send should not carry a competitor's staff.

Each photograph is rendered from the page at its own placement rectangle, not
pulled as the raw embedded image — the raw image can carry a rotation the page
applies, and the page is what the reader of their report saw.

Needs PyMuPDF.
"""
import json
import os
import sys

import fitz  # PyMuPDF

OUT = "/tmp/hymus-photos"

ROOMS = [
    (range(15, 16), "302-open", "Porte de l'unité 302"),
    (range(16, 43), "302-open", None),
    (range(43, 44), "202-open", "Porte de l'unité 202"),
    (range(44, 60), "202-open", None),
    (range(60, 63), "202-laundry", None),
    (range(63, 64), "102-open", "Porte de l'unité 102"),
    (range(64, 69), "102-laundry", None),
    (range(69, 87), "102-bath", None),
]
SKIP = {55, 81, 82}


def main(src: str) -> None:
    doc = fitz.open(src)
    os.makedirs(OUT, exist_ok=True)
    manifest: dict[str, list[dict]] = {}
    for pages, room, note in ROOMS:
        for number in pages:
            if number in SKIP:
                continue
            page = doc[number - 1]
            # One photograph is stored as several image strips stacked down the
            # page (three bands of one picture); the small image at top left is
            # the letterhead's logo. The photograph is the union of the strips.
            best = None
            for image in page.get_images(full=True):
                for rect in page.get_image_rects(image[0]):
                    if rect.width < 150:
                        continue
                    best = rect if best is None else best | rect
            if best is None:
                continue
            long_pt = max(best.width, best.height)
            pix = page.get_pixmap(dpi=int(1400 / long_pt * 72), clip=best)
            n = len(manifest.setdefault(room, [])) + 1
            name = f"{room}-{n}.jpg"
            pix.save(os.path.join(OUT, name), jpg_quality=82)
            manifest[room].append({"file": name, "page": number, "note": note})
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)
    total = sum(len(v) for v in manifest.values())
    print(f"Wrote {total} photographs to {OUT}: " + ", ".join(f"{k} {len(v)}" for k, v in manifest.items()))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
