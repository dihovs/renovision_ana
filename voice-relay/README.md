# Renovision voice relay

The one piece of the voice agent that can't live on Vercel: the WebSocket
Twilio's ConversationRelay keeps open for an entire call. Vercel Route
Handlers deploy as lambda functions and drop WebSocket connections on
timeout, so this small always-on service exists purely to hold that socket
open. It makes no decisions and stores nothing — every reply comes from
`https://www.renovisionana.ca/api/voice/relay/*`, which is where Claude, the
transcript, and the escalation logic actually live. If this service is lost
and redeployed from scratch, no conversation history goes with it.

## Deploy to Fly.io (Montreal region — closest to Laval)

You'll need a Fly.io account (fly.io/app/sign-up) and `flyctl` installed:

```bash
# macOS
brew install flyctl
# Windows (PowerShell)
powershell -c "irm https://fly.io/install.ps1 | iex"
```

Then, from this `voice-relay/` folder:

```bash
fly auth login
fly launch --no-deploy   # accept the existing fly.toml when prompted; don't let it overwrite the app name if you want a specific one
fly secrets set RELAY_SHARED_SECRET="<the same value set as RELAY_SHARED_SECRET in Vercel>"
fly secrets set APP_ORIGIN="https://www.renovisionana.ca"
fly deploy
```

Confirm it's answering:

```bash
curl https://<your-app-name>.fly.dev/health
# -> ok
```

## Wiring it to the rest of the system

1. **Vercel** (renovisionana.ca project → Settings → Environment Variables):
   - `RELAY_SHARED_SECRET` — same random value as above. Treat it like any
     other secret; it's what stops a stranger from posting fake conversation
     turns at `/api/voice/relay/turn`.
   - `RELAY_WS_URL` — `wss://<your-app-name>.fly.dev/relay` (note `wss://`,
     not `https://`, and the `/relay` path).
   - Redeploy after adding these — new env vars only apply to the next build.

2. **Twilio** (Console → Phone Numbers → your number → Configure): change
   **A call comes in** from `/api/voice/incoming` to
   `https://www.renovisionana.ca/api/voice/relay-incoming`. That's the whole
   cutover — everything else on the number stays as it was.

3. **Rollback**, if anything sounds wrong: change that one Voice URL back to
   `/api/voice/incoming`. The turn-based path was never touched and answers
   immediately.

## Checking it's healthy later

```bash
fly status         # is the machine running?
fly logs           # tail what it's seeing per call
```

If `fly status` shows 0 machines running, `min_machines_running` in
`fly.toml` didn't take — a call arriving while the machine is asleep fails
outright, since there's no cold-start grace period the way there is for an
ordinary web request. Fix with `fly scale count 1` if it ever drifts.
