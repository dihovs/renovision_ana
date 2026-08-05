# What is wired to what, in Twilio

One phone number now serves four different jobs, and which code path a given
event reaches depends on settings that live in Twilio's console rather than in
this repo. That is exactly the kind of thing that is invisible when you are
reading the code and infuriating when it is wrong, so it is written down here.

Confirmed live on 2026-08-04.

## The number

**+1 579-999-5979** — `PNcb45032e4c000f063bad49414f1771b0`, Longueuil QC,
SMS + MMS + Voice. This is `SITE_PHONE_TEL` in `src/lib/constants.ts` and the
number printed on the website.

| Twilio setting | Points at | Serves |
|---|---|---|
| Voice webhook | `api.us.elevenlabs.io/twilio/inbound_call` | A customer (or the owner) calling in. ElevenLabs runs the call and calls our Custom LLM. |
| Messaging webhook | `www.renovisionana.ca/api/sms/incoming` | Texts arriving. Replies and STOP. |

**The Voice webhook must keep pointing at ElevenLabs.** It is not ours and
changing it takes Ana off the phone entirely. The Messaging webhook used to
point at ElevenLabs too (`/twilio/inbound-sms`), which was its default when the
number was imported; it was never doing anything, and it is ours now.

## The three ways a call gets placed

Worth keeping straight, because all three end up at Twilio and only one of them
involves Ana:

1. **Ana calls a customer** — `src/lib/voice/outboundDialer.ts` asks ElevenLabs
   to place it (`/v1/convai/twilio/outbound-call`); ElevenLabs uses the Twilio
   credentials it already holds. Nothing of ours touches Twilio directly.
2. **The owner, from his own phone** — `CallButton` is a `tel:` link. No Twilio.
3. **The owner, as the business** — either `src/lib/voice/bridge.ts` (rings his
   mobile, then bridges) or the browser softphone (`Softphone.tsx` →
   `/api/voice/token` → `/api/voice/softphone`). Both set `callerId` to the
   business number so his mobile is never shown.

## The TwiML App

**`APc1c364e2aa570a8027a06fcdc0c39883`** ("Admin Softphone"), Voice Request URL
`https://www.renovisionana.ca/api/voice/softphone`, HTTP POST.

Used *only* by the browser softphone: the Access Token grants outgoing calls
through this one application and nothing else. The mobile-bridge path does not
use it — `bridge.ts` sends inline TwiML with the call-creation request instead,
specifically so that feature adds no public endpoint (see its header).

## Environment variables, and which feature dies without each

| Variable | Needed by | Set? |
|---|---|---|
| `TWILIO_AUTH_TOKEN` | Signature check on `/api/sms/incoming` and `/api/voice/softphone`; HTTP Basic for sending | yes |
| `TWILIO_ACCOUNT_SID` | Sending SMS; the mobile bridge | yes |
| `TWILIO_TWIML_APP_SID` | Browser softphone | yes |
| `TWILIO_API_KEY_SID` | Browser softphone | **no** |
| `TWILIO_API_KEY_SECRET` | Browser softphone | **no** |
| `SMS_FROM_NUMBER` | Optional; falls back to `SITE_PHONE_TEL` | unset, deliberately |
| `OWNER_PHONE_NUMBERS` | Owner mode on the phone; which mobile the bridge rings | yes |
| `OWNER_MOBILE` | Optional override for the above | unset |

**Vercel injects these at build time.** Adding a variable does not change the
running deployment — it needs a rebuild, which is what the empty commit
`4aee731` was for. Anything added later needs the same.

The two API-key variables are the only thing standing between the softphone and
working; until they exist `/admin/calls` shows "Unavailable" and names them.
The secret is shown by Twilio exactly once, at creation.

## Related

- `Docs/Voice-ElevenLabs-Setup.md` — the ElevenLabs side of the voice path
- `Docs/Voice-Outbound-Compliance.md` — why outbound calls are consent-gated
- `supabase/migrations/0022_sms.sql` — why the SMS opt-out list is a table
