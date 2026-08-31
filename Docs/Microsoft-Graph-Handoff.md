# What to ask the Microsoft 365 admin for

**Why this file exists.** Ana's Teams, Outlook and OneDrive features are built,
tested and inert. They need one app registration in the company's Entra (Azure AD)
directory, and that needs the tenant administrator. As of 31 Aug 2026 that is
believed to be **Arman**, not Artush — see `Automation-Blockers.md` §4.

There are two ways this can go, and the first is worth trying before the second
because it may need nothing from the admin at all.

## Route A — Artush registers it himself (try this first)

Most Microsoft 365 tenants leave **"Users can register applications"** switched on.
If it is on here, any account in the directory — including a plain member — can
create the app registration, which produces the tenant ID, client ID and client
secret. Only the final **Grant admin consent** click is reserved for an admin, and
depending on the tenant's user-consent setting even that may not be needed.

**The test takes a minute:** sign in at `entra.microsoft.com` with the Renovision
work account (not Gmail), go to Identity → Applications → App registrations, and
see whether **New registration** is clickable. If it is, follow
`Microsoft-Graph-Setup.md` from step 1 and stop at step 3's consent button.

If sign-in itself fails, there is no member account and only Route B remains.

## Route B — Arman does it

Everything he needs, in one place. Nothing here touches customer data, and none of
it grants access to anyone's calls.

**Create an app registration** in the Renovision Entra directory:

- **Name:** `Renovision Ana`
- **Supported account types:** *Accounts in this organizational directory only*
- **Redirect URI:** platform **Web** →
  `https://www.renovisionana.ca/api/v1/microsoft/callback`

**Add exactly these five delegated (not application) Microsoft Graph permissions**,
then click **Grant admin consent**:

| Permission | What it is for |
|---|---|
| `offline_access` | Staying signed in without re-prompting |
| `User.Read` | Reading which account is connected |
| `Chat.Read` | Artush's own Teams chat messages |
| `Mail.ReadWrite` | His own mailbox, and leaving **draft** replies in it |
| `Files.Read.All` | Finding documents in his OneDrive |

**Nothing else.** No `CallRecords`, no `OnlineMeetings`, no `ChannelMessage`, and
specifically **no `Mail.Send`** — the application refuses to request any of them
(`src/lib/microsoft/scopes.ts`, enforced by a test), so granting them would widen
what a stolen credential could reach and buy nothing. Drafted replies can only be
sent by Artush pressing Send in Outlook; the token is not able to send mail.

**Delegated, not application, matters:** these permissions let the app act *as the
signed-in user and only that user*. Nobody else's mail or chats are reachable, which
is not a promise about behaviour — it is what a delegated token can do.

**Then send Artush three values** (the first two are not secret; the third is):

1. **Directory (tenant) ID** — from the app's Overview page
2. **Application (client) ID** — same page
3. **A client secret** — Certificates & secrets → New client secret, 24-month expiry.
   Its **Value** is shown once and never again. Send it over something private, not
   email or a group chat.

## What happens after

Artush pastes those three into Vercel, the code does the rest, and
`/api/v1/microsoft/status` reports what was actually granted — including a
`neverRequested` list naming the call permissions, so the narrowness is verifiable
rather than promised.
