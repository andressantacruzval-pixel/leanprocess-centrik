-- ─────────────────────────────────────────────────────────────────────────
-- SEED DE DESARROLLO LOCAL — se aplica solo con `supabase start` / `db reset`.
--
-- El registro está restringido a miembros de la comunidad (ver el trigger
-- handle_new_user en 20260511000001_community_whitelist.sql): quien no esté en
-- community_whitelist recibe "COMMUNITY_ONLY: acceso restringido" al registrarse.
--
-- Aquí habilitamos un correo de desarrollo para poder crear cuenta en local.
-- Cámbialo o añade los tuyos como quieras — esto NUNCA toca producción.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.community_whitelist (email, status, nombre, plan_final)
VALUES ('dev@local.test', 'activo', 'Dev Local', 'community')
ON CONFLICT (email) DO NOTHING;
