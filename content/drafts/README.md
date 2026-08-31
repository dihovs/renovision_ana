# Drafts

Blog posts in progress, as JSON matching the `BlogPost` type in
`src/lib/blogPosts.ts`. **Nothing here is on the site** — this folder is outside
the build, and no script writes from here into `src/`.

    npm run content:check                  # validate every draft
    npm run content:check -- <slug>        # validate one
    npm run content:check -- --emit <slug> # print the TS literal to paste

The order is always: draft → check → **owner reads the French** → paste into
`src/lib/blogPosts.ts` by hand. See `Docs/Content-Engine.md`.

A draft stays here after it's published — it's the record of what was written
and the starting point for the next revision. Its slug will then fail the
"already published" check, which is correct: that check is what stops a second
copy of a live post from being pasted in.
