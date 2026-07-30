-- Customer photos for a lead.
--
-- Photos live in Supabase Storage, not in the table: a base64 image in a text
-- column would inflate every row, count against the 500 MB database limit, and
-- get pulled down on every list query. The table stores paths only.
--
-- The bucket is PRIVATE. These are photographs of the inside of customers'
-- homes, often taken because something has gone wrong in them. They are only
-- ever served through short-lived signed URLs generated for the signed-in
-- operator; there is no public URL for any of them.

alter table public.leads
  add column if not exists photo_paths text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('lead-photos', 'lead-photos', false)
on conflict (id) do update set public = false;

-- Same reasoning as the leads table: "Automatically expose new tables" is off,
-- so the server role needs an explicit grant. anon and authenticated get
-- nothing, which is what keeps the photos private.
grant select, insert, update, delete on storage.objects to service_role;

-- Restrict object access to the service role for this bucket specifically.
-- Storage enforces RLS on storage.objects, so without a policy even a granted
-- role is refused — and no policy exists for anon/authenticated by design.
drop policy if exists "service role manages lead photos" on storage.objects;
create policy "service role manages lead photos"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'lead-photos')
  with check (bucket_id = 'lead-photos');
