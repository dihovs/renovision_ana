-- Qualifying answers from the contact form.
--
-- Until now the form asked name/phone/email/message, so every enquiry looked
-- identical until someone called back. These three answers are what the owner
-- actually triages on: an active water-damage emergency shouldn't wait behind
-- a kitchen daydream, and an insurance adjuster with an open claim is a
-- different first phone call than a homeowner.
--
-- All three are nullable on purpose. Old leads were never asked, chat and
-- phone leads still aren't, and the questions are optional on the form —
-- absence means "not asked", never "no".
--
-- Text rather than enums for the same reason as `source` (0011): new roles
-- and referral channels should be a value, not a migration.

alter table public.leads
  add column if not exists contact_role text,
  add column if not exists is_emergency boolean,
  add column if not exists heard_about text;
