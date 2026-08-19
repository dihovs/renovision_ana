#!/usr/bin/env python3
"""
Split one pasted ChatGPT reply into per-object SVG files.

ORD-43. The catalogue's artwork is authored as SVG markup in a chat rather
than generated as images: text output has no picture quota, stays crisp at
any size, and — the reason that matters most here — can be READ and
corrected rather than re-rolled and hoped over.

The reply format the prompt sheet asks for:

    ===SLUG: toilet
    ```svg
    <svg ...>...</svg>
    ```

Everything else in the reply is ignored, so a stray sentence of commentary
does not break the run.

Every block is validated before it is written. A drawing that is not
well-formed XML, or that is missing its viewBox, is REFUSED rather than
written — a broken asset shows as a blank tile in the picker, which is
worse than the drawn figure it would have replaced.

    python3 scripts/split-object-svgs.py <reply-file> [--dry-run]
"""

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
ARTWORK = ROOT / "ios" / "App" / "App" / "Native" / "Artwork"

# Either a fenced block (a pasted markdown reply) or a bare <svg> element
# (the rendered page, where the fences are chrome rather than text). Both
# happen depending on how the reply was captured, and neither is worth a
# second script.
BLOCK = re.compile(
    r"===SLUG:\s*([A-Za-z0-9_\-]+)\s*\n+"
    r"(?:```(?:svg|xml)?\s*\n(?P<fenced>.*?)\n```|(?P<bare><svg\b.*?</svg>))",
    re.S,
)


# `Optional`, not `str | None`: the Mac this runs on ships Python 3.9.
def validate(slug: str, svg: str) -> Optional[str]:
    """Return an error string, or None when the drawing is usable."""
    try:
        root = ET.fromstring(svg)
    except ET.ParseError as err:
        return f"not well-formed XML ({err})"
    if not root.tag.endswith("svg"):
        return f"root element is <{root.tag}>, not <svg>"
    if "viewBox" not in root.attrib:
        return "no viewBox, so it cannot scale to the tile"
    # A drawing with no shapes in it is a blank tile that LOOKS like a bug.
    shapes = {"path", "rect", "circle", "ellipse", "line", "polygon", "polyline", "g"}
    if not any(child.tag.split("}")[-1] in shapes for child in root.iter()):
        return "no shapes in it"
    return None


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    dry = "--dry-run" in sys.argv
    source = Path(sys.argv[1]).expanduser()
    if not source.exists():
        print(f"No such file: {source}")
        return 1

    text = source.read_text()
    blocks = BLOCK.findall(text)
    if not blocks:
        print("Found no ===SLUG: blocks. Was the whole reply copied, markers included?")
        return 1

    ARTWORK.mkdir(parents=True, exist_ok=True)
    written, refused = 0, 0

    for slug, fenced, bare in blocks:
        svg = (fenced or bare).strip()
        problem = validate(slug, svg)
        if problem:
            print(f"  ✗ {slug}: {problem}")
            refused += 1
            continue
        if not dry:
            (ARTWORK / f"{slug}.svg").write_text(svg + "\n")
        print(f"  ✓ {slug} ({len(svg)} bytes)")
        written += 1

    print(f"\n{written} usable, {refused} refused.")
    if dry:
        print("Dry run — nothing written.")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
