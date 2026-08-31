# Ana's memory — proposal before code (ANA-19)

**Status: awaiting the owner's decisions. Nothing is built.** ANA-19 requires this
document to exist and be agreed to first; the three decisions at the bottom are his.

## What problem this solves

Every call starts blank. "Remember that Mme Tremblay only answers after six" works
until the call ends, and then it never happened. `capture_task` is not memory — a
task is a thing to *do*, and it leaves the list when done. A fact about a client is
a thing to *know*, and it should still be known in March.

## What deserves to be remembered — and what does not

Three kinds, no more:

| Kind | Example | Lives |
|---|---|---|
| **Fact about a person or place** | "The Fleury basement floods every spring" · "Mme Tremblay speaks English but writes French" | Until deleted |
| **Standing preference** | "Always add a contingency line on insurance jobs" · "Never book visits on Fridays" | Until deleted |
| **Decision** | "We agreed 15 Sept that the grey tile is final" | Until deleted, shown with its date |

**Deliberately not kinds:** summaries of conversations (they rot, and the transcript
already exists), anything a CRM field already holds (a phone number belongs on the
client, not in a memory), and anything about money owed (invoices are the record).

## The rule that makes it safe — the same one as everywhere else

**Memory is written ONLY from the owner's own dictated words, in an authenticated
owner session.** Never from a tool result. Never from a message body. Never from an
email, a Teams chat, a WhatsApp thread, or a file.

Why this is the whole design: Ana reads the widest untrusted input there is — anyone
can email her owner. If anything she *reads* could become something she *remembers*,
an email becomes a standing instruction with one step: it only has to convince the
model once, and the store replays it forever. The write path therefore accepts one
source — the `remember` tool, callable only inside `ownerToolsFor()`'s authenticated
session — and the enforcement is the writeBoundary pattern, not prompt wording:
the memory-write function appears in `PERMITTED_CRM_WRITES`, and nothing reachable
from a sync or an ingest imports it (a test says so).

**Recall is quoting, not believing.** Memories enter context labelled like messages:
"the owner said, on 12 Sept: …". A memory that contradicts the CRM loses — the CRM
is the record; memory is a sticky note on it.

## Shape

One table, one migration, RLS + service_role grants per the 0040/0046 lesson:

    ana_memories: id, created_at, kind (fact|preference|decision),
                  body text (his words), person_id → people (nullable),
                  job_id → jobs (nullable), source_call_sid,
                  archived_at (nullable — delete = archive, reversible)

Three tools: `remember` (write, repeats back what was kept), `recall`
(read; also woven automatically into `record_brief` for the person/job at hand),
`forget` (archive by spoken match, same fail-toward-asking matcher as tasks).
Admin page lists everything with a delete button — he can always see the whole store.

## Caps that keep it honest

- One memory ≤ 500 characters. A paragraph is a note, not a memory.
- `record_brief` quotes at most 5 memories per record, newest first.
- No memory is ever silently rewritten: correcting one is forget + remember.

## The three decisions that are his

1. **Scope of recall.** Memories surface only on the record they're pinned to
   (recommended), or also as a general "what do I know about…" search?
2. **Unpinned memories.** Allow memories attached to nobody ("we stop taking
   Saturday emergencies")? Recommended yes, capped at 20, read on every call start.
   That is a standing-instruction channel into every future call — worth its own
   yes from him, not a default.
3. **Retention of decisions.** Keep forever, or auto-archive decisions after a year?

Say "build ANA-19 as proposed" (with answers to the three) and it gets built exactly
this shape.
