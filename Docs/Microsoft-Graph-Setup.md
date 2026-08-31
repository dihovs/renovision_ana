# Microsoft Graph — the owner's setup steps (ANA-04)

Fifteen minutes in the Entra portal, once. Nobody else can do these: they need
the Microsoft 365 tenant administrator, which (confirmed 30 Aug 2026) is Artush.

The code side is built: `/api/v1/microsoft/connect` starts consent,
`/api/v1/microsoft/callback` finishes it, `/api/v1/microsoft/status` reports
what is actually held. What follows is only the dashboard work.

## 1. Register the application

[entra.microsoft.com](https://entra.microsoft.com) → Identity → Applications →
**App registrations** → **New registration**.

- **Name:** `Renovision Ana` (what the consent screen shows).
- **Supported account types:** *Accounts in this organizational directory only*.
  Single tenant — the whole point is that only this company's directory works.
- **Redirect URI:** platform **Web**, value
  `https://www.renovisionana.ca/api/v1/microsoft/callback`
  (add `http://localhost:3000/api/v1/microsoft/callback` too if the flow will
  ever be tested locally).

From the app's **Overview** page copy two values into `.env.local` / Vercel:

| Portal field | Env var |
|---|---|
| Directory (tenant) ID | `MICROSOFT_TENANT_ID` |
| Application (client) ID | `MICROSOFT_CLIENT_ID` |

## 2. Create the client secret

**Certificates & secrets** → **New client secret**. Description `renovision-ana`,
expiry 24 months. Copy the **Value** column immediately — it is shown once and
never again. That is `MICROSOFT_CLIENT_SECRET`.

Diary note for the expiry: when it lapses, the admin's Microsoft panel will show
"needs consent" and the fix is a new secret pasted into Vercel, nothing more.

## 3. Add the delegated permissions

**API permissions** → **Add a permission** → **Microsoft Graph** →
**Delegated permissions**, then add exactly these five:

- `offline_access`
- `User.Read`
- `Chat.Read`
- `Mail.Read`
- `Files.Read.All`

Then **Grant admin consent for [tenant]** — the button above the table. Chat.Read
sometimes prompts per-user otherwise; one click here settles it for good.

**Add nothing else.** No CallRecords, no OnlineMeetings, no ChannelMessage, no
Mail.Send. The application never requests them (`src/lib/microsoft/scopes.ts`,
enforced by `scopes.test.ts`), so granting them would do nothing except widen
what a stolen credential could read. The narrowness is the security.

## 4. Generate the token encryption key

On any machine:

    openssl rand -hex 32

That is `MICROSOFT_TOKEN_KEY`. It encrypts the stored refresh token at rest
(AES-256-GCM) — the connect route refuses to run without it rather than storing
a credential in plaintext.

## 5. Set the four env vars in Vercel

Project → Settings → Environment Variables, production:
`MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
`MICROSOFT_TOKEN_KEY`. Redeploy.

## 6. Apply migration 0047, then connect

Run `supabase/migrations/0047_microsoft_tokens.sql` (SQL editor, or
`node scripts/apply-migration.mjs supabase/migrations/0047_microsoft_tokens.sql`
if `SUPABASE_DB_URL` is ever set). Then, signed into the admin, visit:

    https://www.renovisionana.ca/api/v1/microsoft/connect

Sign in as **the account whose mail and chats Ana should read** — the flow
forces the account chooser for exactly this reason. Consent shows the five
permissions above and nothing about calls.

## 7. Verify

    https://www.renovisionana.ca/api/v1/microsoft/status

Wants: `connected: true`, the right `account`, `hasRefreshToken: true`,
`missingScopes: []`, and `neverRequested` listing the call scopes. That response
is ANA-04's "done when", satisfied or not.
