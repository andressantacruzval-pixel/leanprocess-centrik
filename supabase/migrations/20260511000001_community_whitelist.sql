-- ============================================================
-- Migration: 20260511000001_community_whitelist
-- Tabla de acceso para miembros de la comunidad pagada.
-- Estructura idéntica a comunidad_whitelist en proyecto DEP
-- para facilitar la copia directa de datos.
-- ============================================================

-- 1. Tabla community_whitelist (misma estructura que DEP)
CREATE TABLE IF NOT EXISTS public.community_whitelist (
  email                       TEXT        NOT NULL,
  status                      TEXT                 DEFAULT 'activo',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nombre                      TEXT,
  circle_member_id            TEXT,
  plan_final                  TEXT,
  fecha_expiracion_comunidad  TIMESTAMPTZ,
  member_tags                 JSONB,
  space_ids                   JSONB,
  productos                   JSONB                DEFAULT '[]'::jsonb,
  estado_procesamiento        TEXT                 DEFAULT 'pendiente',
  ultima_actualizacion        TIMESTAMPTZ          DEFAULT NOW(),
  con_certificacion           BOOLEAN              DEFAULT FALSE,
  systeme_contact_id          BIGINT,
  telefono                    TEXT,
  CONSTRAINT community_whitelist_email_key PRIMARY KEY (email)
);

CREATE INDEX IF NOT EXISTS idx_cwl_status
  ON public.community_whitelist (status)
  WHERE status = 'activo';

CREATE INDEX IF NOT EXISTS idx_cwl_email_lower
  ON public.community_whitelist (LOWER(email));

-- 2. RLS — solo admin gestiona la tabla directamente
ALTER TABLE public.community_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages whitelist" ON public.community_whitelist;
CREATE POLICY "Admin manages whitelist" ON public.community_whitelist
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- 3. RPC pública: verificar membresía antes del registro (llamable sin JWT)
DROP FUNCTION IF EXISTS public.check_community_member(TEXT);
CREATE FUNCTION public.check_community_member(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.community_whitelist
    WHERE LOWER(email) = LOWER(p_email)
      AND status = 'activo'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_community_member(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_community_member(TEXT) TO authenticated;

-- 4. Trigger handle_new_user: bloquea no-miembros, asigna plan community y crea wallet
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_is_member BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.community_whitelist
    WHERE LOWER(email) = LOWER(NEW.email)
      AND status = 'activo'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'COMMUNITY_ONLY: acceso restringido a miembros de la comunidad';
  END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE name = 'community' LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, plan_id, circle_member)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    v_plan_id,
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.token_wallets (user_id, monthly_allocation, plan_id)
  VALUES (NEW.id, 1000, 'community')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
