-- ─────────────────────────────────────────────────────────────────────────
-- Riesgo de Activos de Información (ISO/IEC 27001 · 27005) — Fase 2
-- El impacto ya vive en information_assets (C·I·D). Aquí se añade la
-- probabilidad (única, ligada al mayor impacto) y la amenaza/vulnerabilidad,
-- más la tabla de controles del activo con su objetivo de mitigación por
-- dimensión. Reutiliza la efectividad de 8 variables de los controles de riesgo.
-- Pertenecen a LeanProcess App; RLS por empresa como el resto de tablas.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Campos de riesgo en el activo ─────────────────────────────────────────
ALTER TABLE public.information_assets
  ADD COLUMN IF NOT EXISTS probability   integer,
  ADD COLUMN IF NOT EXISTS threat        text,
  ADD COLUMN IF NOT EXISTS vulnerability text;

-- ── Controles de seguridad del activo ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_controls (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id              uuid NOT NULL REFERENCES public.information_assets(id) ON DELETE CASCADE,
  description           text,
  -- 8 variables de efectividad (escala 1 | 3 | 5)
  doc                   smallint NOT NULL DEFAULT 1,
  type                  smallint NOT NULL DEFAULT 1,
  segregation           smallint NOT NULL DEFAULT 1,
  evidence              smallint NOT NULL DEFAULT 1,
  freq                  smallint NOT NULL DEFAULT 1,
  nature                smallint NOT NULL DEFAULT 1,
  training              smallint NOT NULL DEFAULT 1,
  monitoring            smallint NOT NULL DEFAULT 1,
  -- Objetivo de mitigación: probabilidad y/o impacto por dimensión
  mitigates_probability boolean NOT NULL DEFAULT false,
  mitigates_c           boolean NOT NULL DEFAULT false,
  mitigates_i           boolean NOT NULL DEFAULT false,
  mitigates_a           boolean NOT NULL DEFAULT false,
  -- Derivados
  score                 integer NOT NULL DEFAULT 8,
  effectiveness         text NOT NULL DEFAULT 'Deficiente',
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_controls_company ON public.asset_controls(company_id);
CREATE INDEX IF NOT EXISTS idx_asset_controls_asset ON public.asset_controls(asset_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.asset_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_controls_select ON public.asset_controls;
CREATE POLICY asset_controls_select ON public.asset_controls
  FOR SELECT USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS asset_controls_insert ON public.asset_controls;
CREATE POLICY asset_controls_insert ON public.asset_controls
  FOR INSERT WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS asset_controls_update ON public.asset_controls;
CREATE POLICY asset_controls_update ON public.asset_controls
  FOR UPDATE USING (public.is_company_editor(company_id)) WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS asset_controls_delete ON public.asset_controls;
CREATE POLICY asset_controls_delete ON public.asset_controls
  FOR DELETE USING (public.is_company_editor(company_id));
