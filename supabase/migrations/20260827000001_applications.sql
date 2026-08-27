-- ─────────────────────────────────────────────────────────────────────────
-- Inventario de Aplicaciones / Software (Application Portfolio Management)
-- Un catálogo de aplicaciones a nivel empresa + sus usos por actividad/proceso.
-- Base: ITIL 4 CMDB · ISO/IEC 19770 (SAM) · TOGAF App Catalog · Gartner APM.
-- Pertenecen a LeanProcess App; RLS por empresa como el resto de tablas.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Catálogo de aplicaciones (a nivel empresa: se define 1 vez) ────────────
CREATE TABLE IF NOT EXISTS public.applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Identidad
  code                text,
  name                text NOT NULL,
  description         text,
  category            text,        -- ERP, CRM, BI, ofimática, RPA, mensajería, custom…
  -- Provisión
  ownership           text,        -- propia | terceros | mixta
  vendor              text,        -- fabricante / proveedor
  deployment          text,        -- on_premise | cloud_saas | cloud_iaas | hibrido
  url                 text,
  -- Gobierno
  criticality         integer,     -- 1-5 (criticidad de negocio)
  business_owner      text,        -- responsable de negocio
  technical_custodian text,        -- responsable técnico (TI)
  status              text NOT NULL DEFAULT 'activo',  -- activo | en_evaluacion | deprecado | a_reemplazar
  -- Automatización / integración
  has_api             boolean NOT NULL DEFAULT false,
  integration_type    text,        -- API | archivo | manual | RPA
  automatable         boolean NOT NULL DEFAULT false,
  -- Seguridad / datos
  handles_personal_data boolean NOT NULL DEFAULT false,
  auth_method         text,        -- SSO | MFA | local | ninguno
  -- Licenciamiento / costo
  license_model       text,        -- suscripción | perpetua | open source | free
  cost_estimate       numeric,
  cost_period         text,        -- mensual | anual | único
  version             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_company ON public.applications(company_id);

-- ── Uso de la aplicación por actividad/proceso (ancla al nodo BPMN) ────────
CREATE TABLE IF NOT EXISTS public.application_usages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  application_id   uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  process_id       uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  bpmn_element_id  text,          -- nodo de la actividad donde se usa
  activity_name    text,          -- snapshot del nombre de la actividad
  note             text,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_usages_company ON public.application_usages(company_id);
CREATE INDEX IF NOT EXISTS idx_application_usages_app ON public.application_usages(application_id);
CREATE INDEX IF NOT EXISTS idx_application_usages_process ON public.application_usages(process_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.applications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_usages ENABLE ROW LEVEL SECURITY;

-- applications
DROP POLICY IF EXISTS applications_select ON public.applications;
CREATE POLICY applications_select ON public.applications
  FOR SELECT USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS applications_insert ON public.applications;
CREATE POLICY applications_insert ON public.applications
  FOR INSERT WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS applications_update ON public.applications;
CREATE POLICY applications_update ON public.applications
  FOR UPDATE USING (public.is_company_editor(company_id)) WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS applications_delete ON public.applications;
CREATE POLICY applications_delete ON public.applications
  FOR DELETE USING (public.is_company_editor(company_id));

-- application_usages
DROP POLICY IF EXISTS application_usages_select ON public.application_usages;
CREATE POLICY application_usages_select ON public.application_usages
  FOR SELECT USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS application_usages_insert ON public.application_usages;
CREATE POLICY application_usages_insert ON public.application_usages
  FOR INSERT WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS application_usages_update ON public.application_usages;
CREATE POLICY application_usages_update ON public.application_usages
  FOR UPDATE USING (public.is_company_editor(company_id)) WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS application_usages_delete ON public.application_usages;
CREATE POLICY application_usages_delete ON public.application_usages
  FOR DELETE USING (public.is_company_editor(company_id));
