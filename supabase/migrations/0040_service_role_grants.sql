-- The server could not write to its own tables.
--
-- Found 26 Aug 2026, chasing why push notifications never arrived. The
-- phone registered on every launch and POST /api/v1/push/tokens returned
-- 500 every time. PostgREST was answering 403:
--
--     permission denied for table device_tokens
--
-- Not RLS -- that reports "new row violates row-level security policy" and
-- service_role bypasses it anyway. Plain table privileges. service_role held
-- REFERENCES, TRIGGER and TRUNCATE on these tables and none of SELECT,
-- INSERT, UPDATE or DELETE; only `postgres` had those.
--
-- The cause is how these three tables were created: run by hand in the SQL
-- editor, which executes as a role whose default privileges do not include
-- the API roles. Every table created by the normal migration path has the
-- grants; these three, added most recently, do not. They are exactly the
-- three the API has been unable to write.
--
-- This was expensive to find because the failure was silent in both
-- directions. Reads came back empty rather than erroring, so the server
-- reported "no device is registered" -- true, and entirely misleading --
-- while the phone was refused on every attempt. Server and phone each
-- looked like the other one's fault.
--
-- Only service_role is granted. anon and authenticated get nothing: RLS is
-- on with no policies, these tables hold a device token, drying equipment
-- and moisture logs, and nothing outside the server has business in them.

grant select, insert, update, delete on table public.device_tokens      to service_role;
grant select, insert, update, delete on table public.equipment_placements to service_role;
grant select, insert, update, delete on table public.moisture_readings  to service_role;

-- Future tables created this way, so the next one does not repeat this.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- PostgREST caches privileges along with the schema.
notify pgrst, 'reload schema';
