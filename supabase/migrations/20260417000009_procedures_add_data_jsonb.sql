-- El store envía ProcedureData con campos en español (titulo, codigo, introduccion,
-- objetivoGeneral, alcance, actividades[], glosario[], riesgos[], sipoc*[]) que no
-- corresponden con las columnas discretas en inglés. Añadimos una columna data JSONB
-- para guardar el documento completo sin mapeos lossy — las columnas discretas
-- (objective, scope, version, etc.) se mantienen por retrocompatibilidad.

ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS data JSONB;
