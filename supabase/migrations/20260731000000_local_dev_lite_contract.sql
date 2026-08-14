-- ─────────────────────────────────────────────────────────────────────────
-- SHIM DE DESARROLLO LOCAL — Contrato "propiedad de Lite"
-- ─────────────────────────────────────────────────────────────────────────
--
-- Esta app (App) y el Hub (Lite) COMPARTEN una misma base de datos Supabase, y
-- las migraciones están repartidas entre DOS repos. Varias migraciones de App
-- (20260731000009_plan_helpers en adelante) dependen de objetos que crea una
-- migración del repo de Lite (`20260731000000_plan_level.sql`), la cual NO está
-- en este repositorio:
--
--   • profiles.plan_type   (text)      — membresía: 'community' | 'free' | 'pro'
--   • profiles.plan_level  (integer)   — escalón del plan 0..3
--   • profiles.credits     (integer)   — tokens de IA del plan
--   • plan_cap(integer)    -> integer  — 20/30/40/50 procesos por nivel
--   • plan_tokens(integer) -> integer  — 1000/2000/3000/4000 tokens por nivel
--   • plan_name(integer)   -> text     — etiqueta legible del plan
--
-- Sin ellos, `supabase start` / `supabase db reset` fallan al replicar el
-- esquema desde cero en LOCAL. Este archivo recrea SOLO ese contrato mínimo
-- para poder levantar la base en local, aislada de producción.
--
-- Es 100% idempotente (IF NOT EXISTS / CREATE OR REPLACE): si algún día
-- conectas el repo real de Lite, no estorba. Valores tomados de src/lib/plans.ts.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Columnas de profiles ─────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_type  text    NOT NULL DEFAULT 'community';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_level integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits    integer NOT NULL DEFAULT 1000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits_comprados integer NOT NULL DEFAULT 0;

-- credits_total = credits + credits_comprados (columna generada, solo lectura).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'credits_total'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN credits_total integer
      GENERATED ALWAYS AS (credits + credits_comprados) STORED;
  END IF;
END $$;

-- ── Funciones del plan (escalera 0..3) ───────────────────────────────────
-- Acota el nivel al rango válido: dato corrupto degrada al plan base, no revienta.
CREATE OR REPLACE FUNCTION public.plan_cap(p_level integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT 20 + LEAST(GREATEST(COALESCE(p_level, 0), 0), 3) * 10;
$$;

CREATE OR REPLACE FUNCTION public.plan_tokens(p_level integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT 1000 * (LEAST(GREATEST(COALESCE(p_level, 0), 0), 3) + 1);
$$;

CREATE OR REPLACE FUNCTION public.plan_name(p_level integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Plan nivel ' || LEAST(GREATEST(COALESCE(p_level, 0), 0), 3)::text;
$$;
