-- Paso 2 del plan de auditoría — consolidar columnas EN/ES en tabla indicators.
-- Decisión: mantener columnas en inglés como estándar. Backfill EN desde ES y drop ES.

UPDATE indicators SET
  name         = COALESCE(name, nombre),
  description  = COALESCE(description, objetivo),
  unit         = COALESCE(unit, unidad_medida),
  frequency    = COALESCE(frequency, frecuencia),
  data_source  = COALESCE(data_source, fuente_datos),
  owner        = COALESCE(owner, responsable_reporte),
  target_value = COALESCE(target_value, NULLIF(meta, '')::numeric);

ALTER TABLE indicators ALTER COLUMN name SET NOT NULL;

ALTER TABLE indicators
  DROP COLUMN nombre,
  DROP COLUMN objetivo,
  DROP COLUMN fuente_datos,
  DROP COLUMN unidad_medida,
  DROP COLUMN frecuencia,
  DROP COLUMN meta,
  DROP COLUMN umbral_verde,
  DROP COLUMN umbral_amarillo,
  DROP COLUMN umbral_rojo,
  DROP COLUMN responsable_reporte,
  DROP COLUMN responsable_monitoreo;
