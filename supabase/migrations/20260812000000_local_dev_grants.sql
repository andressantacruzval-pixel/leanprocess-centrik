-- ─────────────────────────────────────────────────────────────────────────
-- GRANTS DE DESARROLLO LOCAL
-- ─────────────────────────────────────────────────────────────────────────
-- En Supabase producción, los roles `authenticated` / `anon` / `service_role`
-- reciben privilegios de tabla de forma automática a nivel de plataforma. En una
-- base LOCAL creada desde cero (`supabase start` / `db reset`) esos GRANT de DML
-- no existen, y el app falla con "permission denied for table ...".
--
-- Aquí se otorgan los privilegios estándar. La seguridad por FILA la sigue
-- garantizando RLS (las policies de cada tabla): un GRANT de tabla no salta RLS.
-- Corre al final (timestamp alto) para cubrir todas las tablas ya creadas.
-- Idempotente y solo relevante en local.
-- ─────────────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT ALL                          ON ALL TABLES       IN SCHEMA public TO service_role;
GRANT USAGE, SELECT                ON ALL SEQUENCES    IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE                      ON ALL FUNCTIONS    IN SCHEMA public TO authenticated, service_role;

-- Privilegios por defecto para objetos futuros creados por el rol postgres.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
