#!/usr/bin/env python3
"""Pull the 1951 Rue Tansley site photographs out of the source magicplan PDF.

    python3 scripts/extract-tansley-photos.py

Writes `/tmp/tansley-photos/<room>-<n>.jpg` plus a `manifest.json`, which is
what `src/components/admin/tansley-report.render.test.tsx` inlines into the
rendered report. Without it that render prints a photo POINTER on every room
page ("5 photos, see the photos page") and no photographs behind it — which
is exactly the state the first two passes of that report shipped in, and the
reason this is a script in the repo rather than a command somebody ran once.

**Which room a photograph belongs to is read, not guessed.** magicplan gives
each room its own photo section under a `▼Photos/<room>` marker, so the page
number IS the attribution:

    page  7 → Kitchen, 1st Floor
    page 13 → Kitchen, 2nd Floor        (its section runs over two pages)
    page 14 → Kitchen, 2nd Floor
    page 16 → Other (apt 102 corridor / entrance), 2nd Floor
    page 22 → Kitchen, 3rd Floor

Three sections are deliberately NOT extracted: `▼Photos/My New Project` (6
photographs) and the two `▼Photos/<storey>` sections (2 and 5). Those hang off
the project and off a storey; `ReportRoom` carries photographs on a ROOM, and
filing them under a room we picked would be inventing provenance.

Two details that matter and are not obvious:

* **Byte-identical repeats are dropped.** The source reuses one photograph
  across two captions in two places. The same picture printed twice on one
  page reads as a mistake in our report even though it is faithful to theirs.
* **The letterbox bars are cropped.** Several of these are stored as tall
  PNGs with black bands top and bottom, because magicplan padded a portrait
  photo into a fixed frame. Left in, they print as black stripes through the
  photo grid.

Needs PyMuPDF and Pillow, and the source PDF at SRC below.
"""

import hashlib
import io
import json
import os

import fitz  # PyMuPDF
from PIL import Image

SRC = os.path.expanduser("~/Downloads/My New Project Report 9.pdf")
OUT = "/tmp/tansley-photos"

# (source page, room key). The keys are the room ids the render script uses,
# minus its `tansley-` prefix.
SECTIONS = [
    (7, "1f-kitchen"),
    (13, "2f-kitchen"),
    (14, "2f-kitchen"),
    (16, "2f-other"),
    (22, "3f-kitchen"),
]

# magicplan stamps its own mark in the corner of every page at this size.
LOGO = (64, 64)


def crop_letterbox(im: Image.Image) -> Image.Image:
    """Trim near-black bands off the top and bottom, if there are any."""
    grey = im.convert("L")
    width, height = grey.size
    px = grey.load()

    def dark(y: int) -> bool:
        row = [px[x, y] for x in range(0, width, 7)]
        return sum(row) / len(row) < 12

    top = 0
    while top < height and dark(top):
        top += 1
    bottom = height - 1
    while bottom > top and dark(bottom):
        bottom -= 1
    if top == 0 and bottom == height - 1:
        return im
    return im.crop((0, top, width, bottom + 1))


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    doc = fitz.open(SRC)
    manifest: dict[str, list[dict]] = {}
    seen: dict[str, str] = {}

    for page_no, key in SECTIONS:
        page = doc[page_no - 1]

        # Where each image sits on the page, so they come out in the order
        # they are printed rather than in PDF object order.
        placed = []
        for xref, *_ in page.get_images(full=True):
            if any(slot[2] == xref for slot in placed):
                continue
            info = doc.extract_image(xref)
            if (info["width"], info["height"]) == LOGO:
                continue
            for rect in page.get_image_rects(xref):
                placed.append((round(rect.x0), round(rect.y0), xref, info))
        placed.sort(key=lambda slot: (slot[0], slot[1]))

        for _, _, xref, info in placed:
            digest = hashlib.md5(info["image"]).hexdigest()
            if digest in seen:
                print(f"  page {page_no}: repeat of {seen[digest]}, skipped")
                continue
            n = len(manifest.get(key, [])) + 1
            name = f"{key}-{n}.jpg"
            seen[digest] = name
            image = crop_letterbox(Image.open(io.BytesIO(info["image"])).convert("RGB"))
            image.save(os.path.join(OUT, name), "JPEG", quality=85, optimize=True)
            manifest.setdefault(key, []).append(
                {"file": name, "srcPage": page_no, "width": image.size[0], "height": image.size[1]}
            )

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)

    for key, entries in manifest.items():
        print(f"{key}: {len(entries)} photographs")
    print(f"→ {OUT}")


if __name__ == "__main__":
    main()
