#!/usr/bin/env python3
"""
Turn the authored SVGs into asset-catalogue imagesets.

ORD-43. `split-object-svgs.py` writes validated drawings into
ios/App/App/Native/Artwork/<slug>.svg; this puts each one into
Assets.xcassets as `object-<slug>`, which is the name `ObjectArtwork` looks
for. A slug is the whole join between the database, the catalogue and the
picture, so nothing else has to be registered by hand.

**`preserves-vector-representation` is the point.** Without it Xcode
rasterises an SVG once at its natural size and the tile is soft on a
3x screen. With it the drawing scales cleanly, which is the whole reason
this route is SVG and not PNG.

    python3 scripts/install-object-artwork.py
"""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTWORK = ROOT / "ios" / "App" / "App" / "Native" / "Artwork"
ASSETS = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Objects"

CONTENTS = {
    "images": [{"filename": None, "idiom": "universal"}],
    "info": {"author": "xcode", "version": 1},
    "properties": {
        "preserves-vector-representation": True,
        # ORIGINAL, not template: these are coloured illustrations, and
        # template rendering would flatten every one of them to a tint.
        "template-rendering-intent": "original",
    },
}


def main() -> int:
    svgs = sorted(ARTWORK.glob("*.svg"))
    if not svgs:
        print(f"No SVGs in {ARTWORK}")
        return 1

    ASSETS.mkdir(parents=True, exist_ok=True)
    # The folder needs its own Contents.json or Xcode treats it as loose.
    (ASSETS / "Contents.json").write_text(
        json.dumps({"info": {"author": "xcode", "version": 1}}, indent=2) + "\n"
    )

    for svg in svgs:
        name = f"object-{svg.stem}"
        imageset = ASSETS / f"{name}.imageset"
        imageset.mkdir(exist_ok=True)
        shutil.copyfile(svg, imageset / svg.name)
        contents = json.loads(json.dumps(CONTENTS))
        contents["images"][0]["filename"] = svg.name
        (imageset / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n")
        print(f"  ✓ {name}")

    print(f"\n{len(svgs)} installed into {ASSETS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
