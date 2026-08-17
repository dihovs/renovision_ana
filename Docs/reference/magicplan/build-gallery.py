#!/usr/bin/env python3
"""Build a browsable gallery of the magicplan reference screenshots.

Why this exists
---------------
Looking at the reference used to mean an agent taking a screenshot of the whole
phone and then zooming into it — two images per screen, each costing far more
than the text it was being read for. Meanwhile 106 screenshots already sat in
`screens/`, indexed with descriptions in `spec.md` §9, and nothing put the two
together.

This script does, and it costs nothing to run: it reads only FILENAMES and
CAPTIONS. No image is ever decoded or loaded. The output is for the OWNER to
flip through — a human reads pictures far better than prose. Agents should read
`object-model.md` and `screen-map.md` instead, which is the cheap half of the
same knowledge.

It also audits the reference, which is the part that pays for itself: any
screenshot on disk that nobody indexed, and any index entry whose file has gone
missing, are both listed at the top.

Usage
-----
    python3 Docs/reference/magicplan/build-gallery.py

Writes `gallery.html` beside the screenshots. Open it in a browser; print to PDF
from there if a PDF is wanted (Cmd-P → Save as PDF) — a generated PDF would only
duplicate what the browser already does better.
"""

from __future__ import annotations

import html
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = HERE / "spec.md"
SHOTS = HERE / "screens"
OUT = HERE / "gallery.html"


def parse_index(spec_text: str) -> list[tuple[str, list[tuple[str, str]]]]:
    """Pull §9's grouped `| file | description |` tables out of the spec.

    Returns [(group heading, [(filename, description), ...]), ...] in document
    order, so the gallery reads in the order the reference was walked rather
    than alphabetically — which is how a workflow makes sense.
    """
    start = spec_text.find("## 9.")
    if start == -1:
        raise SystemExit("spec.md has no '## 9.' screen index — has it been renamed?")
    section = spec_text[start:]
    # Stop at the next top-level heading, if any.
    end = re.search(r"\n## (?!9\.)", section)
    if end:
        section = section[: end.start()]

    groups: list[tuple[str, list[tuple[str, str]]]] = []
    current = "Uncategorised"
    rows: list[tuple[str, str]] = []

    for line in section.splitlines():
        heading = re.match(r"^###\s+(.*)", line)
        if heading:
            if rows:
                groups.append((current, rows))
                rows = []
            current = heading.group(1).strip()
            continue

        # `| `01-foo.jpg` | Some description |`
        row = re.match(r"^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*$", line)
        if row:
            rows.append((row.group(1).strip(), row.group(2).strip()))

    if rows:
        groups.append((current, rows))
    return groups


def main() -> None:
    groups = parse_index(SPEC.read_text())

    indexed = {name for _, rows in groups for name, _ in rows}
    on_disk = {p.name for p in SHOTS.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}}

    missing = sorted(indexed - on_disk)      # described but not present
    unindexed = sorted(on_disk - indexed)    # present but undescribed

    parts: list[str] = [
        "<!doctype html>",
        '<html lang="en"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        "<title>magicplan reference — screen gallery</title>",
        """<style>
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin:0; padding:2rem clamp(1rem,4vw,3rem); background:#f6f6f8; color:#16181d;
  font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
h1 { font-size:1.6rem; margin:0 0 .3rem; }
h2 { font-size:1.15rem; margin:2.5rem 0 .9rem; padding-bottom:.4rem;
  border-bottom:2px solid #2B5C9E; color:#2B5C9E; }
.lede { color:#5c626d; max-width:62ch; margin:0 0 1.6rem; }
.audit { background:#fff; border:1px solid #e3e5ea; border-left:4px solid #d97706;
  border-radius:8px; padding:.9rem 1.1rem; margin:0 0 1.6rem; }
.audit.ok { border-left-color:#16a34a; }
.audit h3 { margin:0 0 .35rem; font-size:.95rem; }
.audit ul { margin:.35rem 0 0; padding-left:1.2rem; }
.audit code { font-size:.85em; }
.grid { display:grid; gap:1.4rem;
  grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); }
figure { margin:0; background:#fff; border:1px solid #e3e5ea; border-radius:10px;
  overflow:hidden; display:flex; flex-direction:column; }
figure img { width:100%; height:auto; display:block; background:#eceef1; }
figcaption { padding:.65rem .8rem .75rem; font-size:.85rem; }
figcaption .file { display:block; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:.72rem; color:#8a8f99; margin-bottom:.25rem; word-break:break-all; }
@media (prefers-color-scheme: dark) {
  body { background:#111316; color:#e9ebf0; }
  h2 { color:#7ea9e8; border-bottom-color:#7ea9e8; }
  .lede { color:#9aa1ad; }
  figure, .audit { background:#1b1e23; border-color:#2c3039; }
  figure img { background:#22262c; }
}
@media print {
  body { background:#fff; padding:0; }
  .grid { grid-template-columns:repeat(2,1fr); }
  figure { break-inside:avoid; border-color:#ccc; }
  .audit { break-inside:avoid; }
  h2 { break-after:avoid; }
}
</style></head><body>""",
        "<h1>magicplan reference — screen gallery</h1>",
        '<p class="lede">Every reference screenshot with its description, in the order '
        "the app was walked. Built from <code>spec.md</code> §9 — regenerate with "
        "<code>python3 Docs/reference/magicplan/build-gallery.py</code>. "
        "Print to PDF from the browser if you want one.</p>",
    ]

    if missing:
        parts.append('<div class="audit"><h3>Described but missing from disk</h3><ul>')
        parts += [f"<li><code>{html.escape(n)}</code></li>" for n in missing]
        parts.append("</ul></div>")

    if unindexed:
        parts.append(
            '<div class="audit"><h3>On disk but not described in spec.md §9</h3>'
            "<p>Worth a caption — an unlabelled screenshot is one nobody will open.</p><ul>"
        )
        parts += [f"<li><code>{html.escape(n)}</code></li>" for n in unindexed]
        parts.append("</ul></div>")

    if not missing and not unindexed:
        parts.append(
            '<div class="audit ok"><h3>Index and disk agree</h3>'
            f"<p>All {len(indexed)} screenshots described, none missing.</p></div>"
        )

    for heading, rows in groups:
        parts.append(f"<h2>{html.escape(heading)}</h2>")
        parts.append('<div class="grid">')
        for name, description in rows:
            if name not in on_disk:
                continue
            parts.append(
                "<figure>"
                f'<img src="screens/{html.escape(name)}" alt="{html.escape(description)}" loading="lazy">'
                f'<figcaption><span class="file">{html.escape(name)}</span>'
                f"{html.escape(description)}</figcaption>"
                "</figure>"
            )
        parts.append("</div>")

    parts.append("</body></html>")
    OUT.write_text("\n".join(parts))

    print(f"wrote {OUT.relative_to(HERE.parent.parent.parent)}")
    print(f"  {len(indexed)} indexed, {len(on_disk)} on disk")
    if missing:
        print(f"  {len(missing)} described but missing")
    if unindexed:
        print(f"  {len(unindexed)} on disk with no description")


if __name__ == "__main__":
    main()
