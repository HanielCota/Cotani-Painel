-- Usado SOMENTE no CI. A imagem supabase/postgres traz auth, roles, pg_cron,
-- pg_net e vault, mas o schema `storage` é criado pelo serviço Storage do
-- Supabase (fora do banco). Esta é a estrutura mínima que as migrações usam.
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Mesmo acesso que o papel `postgres` tem no Supabase hospedado.
GRANT USAGE ON SCHEMA storage TO postgres;
GRANT ALL ON TABLE storage.buckets TO postgres;

-- DRIFT CONHECIDO: a migração 20260907113000_security_hardening revoga
-- privilégios de `public.rls_auto_enable()`, função criada em produção pelo
-- recurso "RLS automático" do painel do Supabase, fora das migrações. Sem ela
-- o banco não pode ser recriado do zero. Recriada aqui com o mesmo papel:
-- habilitar RLS em toda tabela nova do schema public.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
