-- MMS: the pictures that arrive with a text, and the ones we send.
--
-- The owner asked whether MMS was working, 20 Aug 2026. It was not — it had
-- never been built. Outbound sent only To/From/Body, and the inbound webhook
-- never read NumMedia, so a customer texting a photo of their flooded
-- basement produced a message with the photo silently missing. On this trade
-- that photo is often the whole enquiry.
--
-- Paths into our own private bucket, NOT Twilio's URLs. Twilio's media links
-- expire and need account credentials to fetch, so a stored one is a dead
-- link in a claim file six months later — the same reasoning the WhatsApp
-- media store already follows.

alter table sms_messages
  add column if not exists media_paths text[] not null default '{}';

-- Rendering a thread asks "does this message have pictures", so the index is
-- on emptiness rather than on the contents.
create index if not exists sms_messages_media_idx
  on sms_messages (phone, created_at desc)
  where array_length(media_paths, 1) > 0;

notify pgrst, 'reload schema';
