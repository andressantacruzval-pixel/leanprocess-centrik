-- Paso 6 del plan — reemplazar la columna única `criterion` + string concatenado en `observation`
-- por columnas discretas que reflejen la estructura del store de auditorías.
-- La tabla está vacía, cambio directo sin backfill.

ALTER TABLE public.audit_items
  ADD COLUMN what_to_audit TEXT,
  ADD COLUMN how_to_audit  TEXT,
  ADD COLUMN frequency     TEXT,
  ADD COLUMN responsible   TEXT,
  ADD COLUMN evidence_type TEXT;

-- criterion pasa a ser el nombre/ID del criterio de auditoría, no un blob concatenado
ALTER TABLE public.audit_items ALTER COLUMN criterion DROP NOT NULL;
