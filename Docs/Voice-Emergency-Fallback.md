# If the phone stops working

**How to tell:** you call +1 579-999-5979, it rings a couple of times, then
goes dead. No greeting, no error message, just silence and a drop.

That exact symptom happened once already (Sep 8, 2026) — not a bug in this
codebase, but ElevenLabs' own subscription payment failing. Their side
accepted the call and dropped it a second later; our server never even saw
it fail, because it never got asked. There is no way to detect that kind of
failure automatically today, so this is a manual switch, not an auto-fix.

## The 60-second fix

1. Go to **console.twilio.com**, log in.
2. Search → **Phone Numbers** → click **+1 579 999 5979**.
3. Under **Voice Configuration**, "A call comes in" → set to **Webhook**:
   ```
   https://www.renovisionana.ca/api/voice/fallback
   ```
4. Save.

Calls now ring **your admin softphone** (if `/admin/phone` is open in a
browser somewhere) **and your own mobile at the same time** — whichever you
pick up first wins. The caller still sees the business number, not your
personal one.

## Once the real problem is fixed

Go to **elevenlabs.io → Conversational AI → Phone Numbers**, open
**+1 579-999-5979**, and reassign the agent (**My Agent**) again — that's
what pointed the number here in the first place, and doing it again should
take the number back. **This has not been tested against a live outage** —
after you do it, place one real test call and confirm Ana actually answers
before assuming it's back to normal.

## Checking which one is actually live, without guessing

Vercel → Logs → search `/api/voice/el/init`. If a real call shows up there,
ElevenLabs still owns the number. If a call shows up under
`/api/voice/fallback` instead, the manual switch is the one answering.

## Why this can't just happen automatically

ElevenLabs' native Twilio integration means **they** control the number's
Voice URL, not us — their own phone-number settings have no
forwarding/fallback field at all. Building true automatic failover means
giving up that native integration for a version where our own server always
answers first and decides whether to hand the call to Ana — a real project,
not a quick fix, and one that touches the only phone line the business has.
Worth doing eventually; not worth rushing the same night a real outage just
happened.
