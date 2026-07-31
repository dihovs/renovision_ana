-- Where a lead came from.
--
-- Until now every lead was implicitly a website lead, because the chat widget
-- was the only way one could arrive. The phone agent breaks that assumption:
-- a call and a web form are different kinds of enquiry with different response
-- expectations, and a pipeline that cannot tell them apart cannot tell you
-- whether the phone agent is earning its keep.
--
-- Text with a default rather than an enum: new channels keep appearing —
-- WhatsApp, a QR code on a van — and each one should be a value, not a
-- migration.

alter table public.leads
  add column if not exists source text not null default 'website';

create index if not exists leads_source_idx on public.leads (source);

-- Everything that already exists arrived through the widget, which is the
-- truth rather than an assumption: the phone path did not exist when these
-- rows were written.
update public.leads set source = 'website' where source is null;
