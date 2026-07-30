# Voice Agent — Build Plan (N1)

**Owner:** Artush · **Status:** not started · **Last updated:** 2026-07-30

The AI receptionist that answers calls to **+1 579-990-3077** when Artush can't.
This file is the plan of record — update statuses here rather than re-deciding
in chat.

---

## What it must do (owner's spec, unchanged)

From the original brief, restated so it can be checked off:

1. **Answer every call except an exception list.** Known numbers ring Artush
   directly; everyone else reaches the agent.
2. **Collect a lead like the chat widget does — but shallower.** Name, phone,
   what's wrong, address. Do not attempt a full scoped estimate by voice.
3. **Never quote a price on the phone.** If the caller pushes for a number,
   direct them to the chat widget on the website, which gives a real itemized
   range.
4. **"I want to speak to Artush"** → take the reason and contact details, email
   Artush so he can call back.
5. **Genuine emergency** → transfer the call live. If he doesn't answer, take
   the details and email immediately.

---

## Architecture (decided)

```
Caller → Teams number (+1 579-990-3077)
       → call forwarding
       → Twilio number
       → ElevenLabs Agent  ── tool call ──→  /api/voice/lead  (this repo)
                                                  ↓
                                          Supabase + Resend
                                          (same pipeline as chat)
```

**Why this shape.** ElevenLabs has a native Twilio integration, so the
telephony plumbing is configuration rather than code. The agent reaches this
codebase through a webhook tool, which means a phone lead lands in the *same*
`leads` table and the *same* notification email as a chat lead. One pipeline,
one inbox, one CRM.

**Rejected alternatives, and why:**

- *Azure Communication Services / Teams Phone extensibility* — more moving
  parts and Microsoft licensing for no gain over Twilio here.
- *Microsoft Copilot call delegation* — early access, requires an M365 Copilot
  licence, and can't call a custom API to file a lead.
- *ElevenLabs' own phone numbers* — not offered; a SIP/Twilio provider is
  required either way.

---

## Open questions (must be answered before building)

| # | Question | Why it blocks |
|---|---|---|
| 1 | Can the Teams tenant forward to an external PSTN number? | If not, the number has to move to Twilio outright — a bigger change, and the published number is on the website, GBP, Facebook and Instagram. |
| 2 | Which model runs the conversation? | Latency vs quality. See below. |
| 3 | What counts as an emergency? | Determines when it interrupts Artush. Needs his words, not mine. |
| 4 | Bilingual from day one? | Default site language is French. A French caller met with English is worse than voicemail. |

### On question 2 — the latency tradeoff

Published benchmarks put sub-800 ms round trip as "good", 800–1200 ms as
acceptable for business calls, and 1500 ms+ as noticeably robotic. Routing to
Claude as a custom LLM adds a network hop over ElevenLabs' own hosted models.
Haiku is the speed tier and is the sensible first try; the honest answer is
that this needs measuring on a real call, not predicting.

---

## Cost (order of magnitude, needs confirming at signup)

| Item | Note |
|---|---|
| Twilio local number | ~$1.15/month, plus per-minute |
| ElevenLabs Agents | ~$0.08–0.10/minute |
| LLM tokens | Separate, small at Haiku rates |

A true vanity number is a **short code** at roughly $1,000/month — the wrong
product. A regular local number in **579** (matches the current number), **450**
(classic Laval) or **514** (Montreal) is what's wanted.

---

## Build order

- [ ] **V0 — Unblock.** Answer Q1 above. Test a forward from Teams to any
      mobile. If forwarding is blocked, stop and re-plan the number.
- [ ] **V1 — Accounts.** Twilio account + number purchased. ElevenLabs account.
      *Owner must do this; Claude cannot create accounts or purchase numbers.*
- [ ] **V2 — Lead webhook.** `POST /api/voice/lead` in this repo: accepts name,
      phone, description, address, urgency; writes via the existing
      `saveLead()`; sends the existing owner notification. Marked
      `source: 'phone'` so phone leads are distinguishable in the pipeline.
- [ ] **V3 — Agent script.** System prompt encoding the five rules above,
      including the "never quote a price" guardrail and the redirect to the
      chat widget. Bilingual greeting.
- [ ] **V4 — Escalation.** Warm transfer on emergency; email fallback when
      unanswered. Exception list by caller ID handled inside the agent rather
      than in Teams, so it's editable without touching telephony.
- [ ] **V5 — Live test.** Call it. Measure real latency. Adjust model if the
      pause is noticeable.
- [ ] **V6 — Cutover.** Point the Teams number at it, out of hours first.

---

## Things that will go wrong (and the design that prevents them)

**The agent invents a price.** The single biggest brand risk — a spoken number
becomes a promise. Prevented by giving the agent no pricing data at all, the
same way the chat model is never shown sell rates. It cannot quote what it
does not have.

**A real emergency waits in a phone tree.** Prevented by making escalation the
first branch, not the last: urgency is detected before scope-gathering starts.

**A lead is captured and lost.** Prevented by reusing the existing lead
pipeline, which already stores, emails, and fails loudly rather than silently.

---

## Related

- Estimator lives in `src/lib/estimator/` — the agent must never reach it.
- Chat guardrails in `src/app/api/chat/chatTools.ts` are the model for the
  agent's script; reuse the wording where it fits.
- Lead pipeline: `src/app/api/leads/route.ts` + `src/lib/leadStore.ts`.
