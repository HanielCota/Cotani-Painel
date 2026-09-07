DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cotani_backend') THEN
    CREATE ROLE cotani_backend
      NOLOGIN
      NOINHERIT
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

GRANT cotani_backend TO postgres;
GRANT USAGE ON SCHEMA public TO cotani_backend;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> '_prisma_migrations'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO cotani_backend', target.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO cotani_backend USING (true) WITH CHECK (true)',
      target.relname || '_backend_access',
      target.relname
    );
  END LOOP;
END
$$;

REVOKE ALL ON TABLE public."_prisma_migrations" FROM cotani_backend;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cotani_backend;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO cotani_backend;
