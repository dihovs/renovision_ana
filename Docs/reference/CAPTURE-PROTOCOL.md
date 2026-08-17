# Capturing reference cheaply

Written after a session where studying magicplan cost more than building from it
did. The lesson is not "take fewer screenshots" — it is that **an image is the
most expensive way to learn a fact, and it stays expensive.**

## Why images cost twice

1. **When taken.** One screenshot costs roughly a thousand-plus tokens. A zoom
   into it costs again. Full screen + zoom = two images for one screen.
2. **Every turn afterwards.** Images stay in the conversation and are re-sent
   with every subsequent message until the history is compacted. Fifty
   screenshots is not a one-off charge; it is a tax on every message that
   follows.

The second point is what actually hurt. A long session that captured a lot early
paid for those captures again and again.

## Cheaper, in order of preference

**1. Text the app already exposes.**
Their PDF exports were more informative than screenshots of the same screens —
page structure, exact wording, the numbered legend, the perimeter contradiction —
and cost a fraction. Extract with PDFKit:

```bash
swift <<'SWIFT' - "/path/to/file.pdf"
import Foundation
import PDFKit
let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1]))!
for i in 0..<doc.pageCount { print("=== PAGE \(i+1) ===\n" + (doc.page(at: i)?.string ?? "")) }
SWIFT
```

Getting a PDF off the phone: generate it in the app, then AirDrop to the Mac. It
lands in `~/Downloads`. Note the in-app PDF viewer does **not** respond to scroll
under iPhone Mirroring, so screenshotting it is not an option anyway.

**2. Their public help centre.** Web pages read as text through the browser tools
at a fraction of a screenshot's cost, and they describe features precisely — the
Fields-vs-Forms distinction came from an article, not from the UI.

**3. The database.** When the question is "did that save", query it. One SQL
result settled a colour round-trip that three screenshots had failed to show.

**4. Screenshots — last, and deliberately.**
- **Make the window bigger first.** Most zooms this session existed only because
  the mirrored phone was rendered small. A larger window means one legible
  screenshot instead of screenshot-plus-zoom.
- **One capture per screen.** Not one per attempt.
- **Write the finding down immediately**, then never look again. The doc is the
  artifact; the screenshot is scaffolding.

## The rule that matters most

**Capture in a short chat that ends.** Gather, write into
`Docs/reference/magicplan/`, stop. The images die with that chat; the text lives
in the repo and costs almost nothing to read forever.

Never re-derive from images in a working chat. If it was worth knowing twice, it
belonged in a document the first time.

## What already exists — read this before capturing anything

- **`object-model.md`** — the object model, property sheets at all four depths,
  statistics with real definitions, the photo editor in full, action bars,
  exports, two report layouts. The authority.
- **`spec.md` §9** — every screenshot indexed with a description.
- **`gallery.html`** — all 106 screenshots laid out with captions, for a **human**
  to flip through. Regenerate with
  `python3 Docs/reference/magicplan/build-gallery.py`. It also audits the
  reference: anything on disk without a caption, anything captioned without a
  file. Costs nothing to run — it reads filenames, never images.
- **`owner-walkthrough.md`** — the scan flow, narrated by the owner. Beats
  `interactions-scan.md`, which predates it.
- **`editor-chrome-design.md`** — plan-editor chrome, section by section.

**An agent should read the text and leave `gallery.html` to the owner.** The
gallery exists because a human reads pictures better than prose; the text exists
because an agent reads prose far cheaper than pictures. Same knowledge, two
audiences, and the split is the whole point.
