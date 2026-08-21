-- ─────────────────────────────────────────────────────────────────────────
-- Oportunidades de mejora (planes de acción) por proceso.
--
-- Se generan a partir del análisis de riesgos y del mapeo de flujo de valor.
-- Cada oportunidad tiene tres variables cualitativas puntuadas 1/3/5 (5 = muy
-- bueno: bajo costo / baja complejidad / corto tiempo; 1 = muy malo) y campos de
-- gestión del plan de acción (responsable, fechas, estado, avance, cierre).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.improvement_opportunities (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  process_id       UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  -- 1/3/5, 5 = mejor (menor costo, menor complejidad, menor tiempo)
  cost_score       INTEGER NOT NULL DEFAULT 3 CHECK (cost_score IN (1,3,5)),
  complexity_score INTEGER NOT NULL DEFAULT 3 CHECK (complexity_score IN (1,3,5)),
  time_score       INTEGER NOT NULL DEFAULT 3 CHECK (time_score IN (1,3,5)),
  -- Gestión del plan de acción
  responsible      TEXT,
  start_date       DATE,
  end_date         DATE,
  status           TEXT NOT NULL DEFAULT 'propuesta'
                     CHECK (status IN ('propuesta','aprobada','en_progreso','cerrada','descartada')),
  progress_notes   TEXT NOT NULL DEFAULT '',
  progress_pct     INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  close_date       DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_improvement_opportunities_process ON public.improvement_opportunities(process_id);
CREATE INDEX IF NOT EXISTS idx_improvement_opportunities_company ON public.improvement_opportunities(company_id);

-- updated_at automático (la función set_updated_at ya existe).
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.improvement_opportunities;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.improvement_opportunities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS (mismo patrón que value_activities / indicators) ──────────────────
ALTER TABLE public.improvement_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "improvement_opportunities_select" ON public.improvement_opportunities;
CREATE POLICY "improvement_opportunities_select" ON public.improvement_opportunities
  FOR SELECT USING (company_id IS NOT NULL AND is_company_member(company_id));

DROP POLICY IF EXISTS "improvement_opportunities_insert" ON public.improvement_opportunities;
CREATE POLICY "improvement_opportunities_insert" ON public.improvement_opportunities
  FOR INSERT WITH CHECK (company_id IS NOT NULL AND is_company_editor(company_id));

DROP POLICY IF EXISTS "improvement_opportunities_update" ON public.improvement_opportunities;
CREATE POLICY "improvement_opportunities_update" ON public.improvement_opportunities
  FOR UPDATE USING (company_id IS NOT NULL AND is_company_editor(company_id));

DROP POLICY IF EXISTS "improvement_opportunities_delete" ON public.improvement_opportunities;
CREATE POLICY "improvement_opportunities_delete" ON public.improvement_opportunities
  FOR DELETE USING (company_id IS NOT NULL AND is_company_editor(company_id));

-- Grants (en la nube "Automatically expose new tables" también los aplica; esto
-- lo hace explícito y cubre bases locales). RLS sigue filtrando por fila.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.improvement_opportunities TO authenticated;
GRANT ALL ON public.improvement_opportunities TO service_role;
