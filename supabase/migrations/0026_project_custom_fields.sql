-- Renovision AnA — custom fields on a project.
--
-- Clients, properties and quotes already carry a `custom` jsonb bag driven by
-- the definitions in app_settings.custom_fields. Projects did not, which is
-- the wrong way round for insurance work: the claim number, the carrier, the
-- adjuster and the category of water all describe the JOB, not the customer,
-- and a customer with two losses would otherwise overwrite their own claim.
--
-- Same shape as everywhere else — { fieldId: value } — so one renderer and
-- one settings screen serve every entity.

alter table public.projects
  add column if not exists custom jsonb not null default '{}'::jsonb;
