-- ─────────────────────────────────────────────────────────────────────────
-- Catálogo del TIPO de mejora en improvement_opportunities.
--
-- Clasifica cada oportunidad por su objetivo. Máximo 6 categorías; si se
-- necesitan más, ampliar el CHECK. El default 'eficiencia' rellena las filas
-- existentes sin romperlas. El código tolera la ausencia de esta columna
-- (persiste el tipo aparte y por mejor esfuerzo), así que esta migración se
-- puede aplicar en cualquier momento sin coordinación con el despliegue.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.improvement_opportunities
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'eficiencia';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'improvement_opportunities_category_check'
  ) THEN
    ALTER TABLE public.improvement_opportunities
      ADD CONSTRAINT improvement_opportunities_category_check
      CHECK (category IN ('eficiencia','eficacia','riesgos','calidad','experiencia','cumplimiento'));
  END IF;
END $$;
