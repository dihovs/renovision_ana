-- Renovision AnA — the property a project is about.
--
-- WHY THIS IS NOT THE CLIENT'S ADDRESS
--
-- `projects.client_id` already reaches a client with an address, and that
-- address is where the invoice goes. It is routinely NOT where the water is:
-- a landlord in one city owns the flooded triplex in another, an insurer's
-- adjuster is the contact for a building they have never lived in, and a
-- property manager is billed for a dozen addresses at once. A crew driving to
-- the billing address is a wasted morning.
--
-- So the job carries its own. Three columns rather than one blob because the
-- reference's card shows three lines and because a postal code is the part
-- worth searching on in a province where street names repeat in every
-- borough.
--
-- All nullable: a job is very often created from the van with nothing known
-- but that somebody's basement is wet, and refusing to record it until an
-- address is typed is how measurements end up in a notes app.
alter table public.projects
  add column if not exists address_line1 text,
  add column if not exists address_city text,
  add column if not exists address_postal text;

notify pgrst, 'reload schema';
