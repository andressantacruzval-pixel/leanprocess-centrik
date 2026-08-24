-- ─────────────────────────────────────────────────────────────────────────
-- Gestión de Activos de Información por Procesos (ISO/IEC 27001) — Fase 1
-- Tablas del inventario de activos y su trazabilidad (operaciones por proceso).
-- El riesgo de activos (amenazas/vulnerabilidades/controles) llega en Fase 2.
-- Pertenecen a LeanProcess App; RLS por empresa como el resto de tablas.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Inventario de activos de información ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.information_assets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id            uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  org_unit_id           uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  -- Ancla opcional al nodo BPMN (Almacén de datos / Objeto de datos)
  bpmn_element_id       text,
  -- Identificación
  code                  text,
  name                  text NOT NULL,
  description           text,
  asset_type            text,       -- Información, Software, Hardware, Red, Servicio, Personas, Físico, Intangible
  format                text,       -- Digital, Físico, Verbal
  -- Responsabilidad
  owner                 text,       -- propietario (accountable)
  custodian             text,       -- custodio
  users                 text,
  -- Ubicación
  location              text,
  -- Clasificación C·I·D (escala 1-5, misma matriz que riesgos)
  confidentiality       integer,
  integrity             integer,
  availability          integer,
  criticality           integer,    -- derivada (máx de C·I·D), guardada para consultas/heatmap
  label                 text,       -- Público / Interno / Confidencial / Restringido
  -- Legal / cumplimiento
  has_personal_data     boolean NOT NULL DEFAULT false,
  personal_data_category text,
  legal_requirements    text,
  retention_period      text,
  disposal_method       text,
  -- Estado / metadatos
  status                text NOT NULL DEFAULT 'activo',
  review_date           date,
  next_review_date      date,
  version               text NOT NULL DEFAULT '1.0',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_information_assets_company ON public.information_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_information_assets_process ON public.information_assets(process_id);

-- ── Operaciones sobre el activo por proceso (trazabilidad / Data Journey) ──
CREATE TABLE IF NOT EXISTS public.asset_operations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id           uuid NOT NULL REFERENCES public.information_assets(id) ON DELETE CASCADE,
  process_id         uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  operation          text NOT NULL,   -- crea | usa | almacena | transforma | transfiere | elimina
  source_process_id  uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  target_process_id  uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_operations_company ON public.asset_operations(company_id);
CREATE INDEX IF NOT EXISTS idx_asset_operations_asset ON public.asset_operations(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_operations_process ON public.asset_operations(process_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.information_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_operations   ENABLE ROW LEVEL SECURITY;

-- information_assets
DROP POLICY IF EXISTS information_assets_select ON public.information_assets;
CREATE POLICY information_assets_select ON public.information_assets
  FOR SELECT USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS information_assets_insert ON public.information_assets;
CREATE POLICY information_assets_insert ON public.information_assets
  FOR INSERT WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS information_assets_update ON public.information_assets;
CREATE POLICY information_assets_update ON public.information_assets
  FOR UPDATE USING (public.is_company_editor(company_id)) WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS information_assets_delete ON public.information_assets;
CREATE POLICY information_assets_delete ON public.information_assets
  FOR DELETE USING (public.is_company_editor(company_id));

-- asset_operations
DROP POLICY IF EXISTS asset_operations_select ON public.asset_operations;
CREATE POLICY asset_operations_select ON public.asset_operations
  FOR SELECT USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS asset_operations_insert ON public.asset_operations;
CREATE POLICY asset_operations_insert ON public.asset_operations
  FOR INSERT WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS asset_operations_update ON public.asset_operations;
CREATE POLICY asset_operations_update ON public.asset_operations
  FOR UPDATE USING (public.is_company_editor(company_id)) WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS asset_operations_delete ON public.asset_operations;
CREATE POLICY asset_operations_delete ON public.asset_operations
  FOR DELETE USING (public.is_company_editor(company_id));
