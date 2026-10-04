-- The role the served kernel connects as, for the device journeys this
-- repository's own job runs. It is platformkit's apps/platformkit/postgres-init.sql
-- copied and cited: this checkout cannot read that file (it is a different
-- repository, with no Go module and no workspace link to the first), so the one
-- line that prepares the database lives here beside the harness that needs it.
-- The kernel's own reasoning travels with it:
--
-- The application connects as platformkit_app, never as the owner. The role is
-- NOSUPERUSER NOBYPASSRLS, so the FORCE ROW LEVEL SECURITY policies installed by
-- the tenancy migration actually constrain it; a superuser would silently bypass
-- every policy and the isolation the journeys depend on would hold while proving
-- nothing. Migrations connect as the owner (postgres), which holds the DDL rights.
CREATE ROLE platformkit_app LOGIN PASSWORD 'platformkit' NOSUPERUSER NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO platformkit_app;

-- Tables and sequences do not exist yet: migrations create them later, as the
-- owner. Default privileges hand each new one to the app role as it appears.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platformkit_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT USAGE, SELECT ON SEQUENCES TO platformkit_app;
