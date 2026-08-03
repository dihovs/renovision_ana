# Voice architecture — decision record

Historical. Kept so the same ground isn't re-covered. The live phone path is
ElevenLabs Agents (`src/app/api/voice/el/*`); see `Docs/Voice-ElevenLabs-Setup.md`.

## Why the phone system is turn-based, not socket-based

Vercel Route Handlers deploy as lambda functions. Per this fork's own docs
(`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`):

> "WebSockets won't work because the connection closes on timeout, or after
> the response is generated."

That single constraint shaped everything. A phone call needs an audio
connection held open for its entire duration; a Route Handler cannot hold one.
So the original design (`src/app/api/voice/{incoming,turn,status}`) made each
conversational turn one ordinary HTTP request — Twilio `<Gather input="speech">`
posts what the caller said, the handler answers with TwiML, the socket question
never arises. It costs interruptibility and buys running the phone system on
the same infrastructure as the website, with no second host to keep alive.
That path still exists as the rollback route.

## The ConversationRelay / Fly.io bridge (built, then cancelled)

Twilio's `<Connect><ConversationRelay>` gives natural, interruptible speech —
but only by keeping a WebSocket open for the whole call. Since Vercel can't
terminate that socket, the approach required a second always-on service. The
implementation was:

- `voice-relay/` — a small Node service deployed to Fly.io (Montreal region,
  closest to Laval), sized `min_machines_running = 1` because a call arriving
  at a sleeping machine fails outright; there's no cold-start grace period the
  way there is for an ordinary web request. It made no decisions and stored
  nothing: it held the socket and forwarded every turn to
  `https://www.renovisionana.ca/api/voice/relay/*`, where Claude, the
  transcript, and the escalation logic lived. Losing and redeploying it took no
  conversation history with it.
- `POST /api/voice/relay-incoming` — answered Twilio's inbound webhook with
  TwiML pointing the call at `wss://<fly-app>.fly.dev/relay`.
- `POST /api/voice/relay/{setup,turn}` — the brain, authenticated with a shared
  secret (`RELAY_SHARED_SECRET`) rather than a Twilio signature, since the
  caller was the bridge, not Twilio.

Cutover and rollback were each a one-line change to the Twilio number's Voice
URL, which is why `relay-incoming` was a separate route rather than a flag on
`incoming`.

**Cancelled 2026-08.** ElevenLabs Agents provides the same interruptible
streaming voice while owning the telephony leg itself, so the second host —
its Fly.io bill, its deploy story, its "is the machine awake?" failure mode —
bought nothing. The Fly app is deleted and all of the above code is removed.
`RELAY_SHARED_SECRET` and `RELAY_WS_URL` are dead environment variables and can
be removed from Vercel.

If a socket-based path is ever wanted again, the constraint at the top of this
file has not changed: it needs a host that is not Vercel.
