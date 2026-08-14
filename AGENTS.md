<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:renovision-reference -->
# Start here

**Read `Docs/INDEX.md` first.** It is the single door to everything: what to build next, what
is already built, all reference material, and — importantly — which document wins when two
disagree. There are two generations of magicplan research in this repo and they overlap.

Then `ORDERS.md`: twelve sequenced work orders. One at a time, in order. Commit per order
with the id as prefix. If an order's premise turns out to be wrong, **stop and report** rather
than improvising a substitute.

Before building anything, check `Docs/REFERENCE-STATUS.md` — this source audited against the
reference, with file and symbol citations. Several things that look absent are already built.

Reference screenshots live in `Docs/reference/`. Open them a few at a time; never read the
whole `screens/` directory into context.

Reuse the reference's workflow, IA and interaction patterns freely. Do **not** copy its icon
set, 3D renders or illustrations — treat those as functional requirements and draw our own.
Quoted copy is for behavioural precision, not strings to ship. Anything marked `[inferred]`
or `[uncertain]` is a guess: flag it, do not implement it as fact.
<!-- END:renovision-reference -->
