-- audits.process_id requiere UNIQUE para que el upsert del auditStore pueda usar
-- ON CONFLICT (process_id). Sin esto, el POST /rest/v1/audits?on_conflict=process_id
-- devuelve 400: "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification".
--
-- Logica de negocio: un proceso tiene como maximo un programa de auditoria.

-- Deduplicar antes de agregar la constraint: si quedaron filas huerfanas por
-- escrituras previas sin upsert real, conservar la mas reciente por process_id.
DELETE FROM public.audits a
USING public.audits b
WHERE a.process_id = b.process_id
  AND a.updated_at < b.updated_at;

ALTER TABLE public.audits
  ADD CONSTRAINT audits_process_id_unique UNIQUE (process_id);