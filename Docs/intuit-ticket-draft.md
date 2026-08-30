# Intuit developer ticket — draft

**File at:** https://help.developer.intuit.com (Developer Support → "Ask a question").
Not the community forum — this needs an answer you can rely on in writing.

**Before sending, fill in the two blanks below.** Use the legal entity name exactly
as it appears at the Registraire des entreprises du Québec, character for
character. A support agent checking eligibility will check the registered entity,
not the trade name.

---

**Subject:** Quebec-based business — production API keys for a private app on our own QBO company

---

Hello,

I run a small renovation and restoration company in Laval, Quebec, Canada. We
use QuickBooks Online for our own books.

We have built our own internal CRM, which raises our invoices. I want it to
write those invoices into our own QuickBooks Online company — nothing more. To
be explicit about the scope:

- One QBO company file: our own. No client or third-party company files.
- One direction: our CRM pushes invoices into QBO. We read nothing back.
- Not listed anywhere. No QuickBooks App Store listing, no other users, no
  distribution of any kind.
- The app is used only by our own staff, on our own data.

My question is about eligibility. Your App Partner Program pages state the
program is for partners based in "the US, UK, Australia, and Canada (excluding
Quebec)". We are in Quebec. Separately, I understand that production keys are
released only after the app assessment questionnaire, including for private
apps.

So I would like to confirm, in writing, before we build anything against your
API:

1. Does the Quebec exclusion apply to a developer account that only ever
   creates a **private app for its own company file**, or does it apply only to
   partners publishing or listing an app?

2. If a Quebec-based business can proceed: can we complete the app assessment
   and be issued **production keys** for our own QBO company, on the scope
   described above?

3. If a Quebec-based business cannot proceed: is there any supported route to
   API access for our own company's data — a different program, an arrangement
   through a partner of record, or anything else? If there is none, please say
   so plainly, so we can stop pursuing it and use CSV import instead.

If the answer to (1) or (2) turns on our incorporation province rather than
where the business operates, please say which one is the test.

Company details:

- Legal entity name: __________________________ (as registered with the
  Registraire des entreprises du Québec)
- NEQ: __________________________
- Trade name: Renovision AnA
- Address: 68 Boulevard Cartier Ouest, Laval, QC H7N 2A3, Canada
- Website: https://www.renovisionana.ca
- Phone: +1 579-999-5979
- Intuit account email: <the email on the QuickBooks Online subscription>

Thank you,
Artush
Renovision AnA

---

## Why this matters here

This is the blocker in `Automation-Blockers.md` §3. It gates the live
QuickBooks sync only — the CSV export at `/admin/invoices/export` already
covers the bookkeeping, so nothing is waiting on this answer. Expect 3–10
business days.

**Record the answer in `Automation-Blockers.md` §3 when it arrives, including a
"no".** A documented "no" is worth as much as a yes: it stops this question
being asked again in six months.
