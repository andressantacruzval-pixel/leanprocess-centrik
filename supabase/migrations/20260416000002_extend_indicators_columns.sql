-- Extiende la tabla `indicators` con las columnas que usa StoredIndicator (nombres en español).
-- El store guarda estos campos directamente; sin ellos el insert falla con "column not found".
-- `name` pasa a nullable para no romper inserts del store que no lo populan.

ALTER TABLE public.indicators
  ALTER COLUMN name DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS nombre              TEXT,
  ADD COLUMN IF NOT EXISTS objetivo            TEXT,
  ADD COLUMN IF NOT EXISTS fuente_datos        TEXT,
  ADD COLUMN IF NOT EXISTS unidad_medida       TEXT,
  ADD COLUMN IF NOT EXISTS frecuencia          TEXT,
  ADD COLUMN IF NOT EXISTS meta                TEXT,
  ADD COLUMN IF NOT EXISTS umbral_verde        TEXT,
  ADD COLUMN IF NOT EXISTS umbral_amarillo     TEXT,
  ADD COLUMN IF NOT EXISTS umbral_rojo         TEXT,
  ADD COLUMN IF NOT EXISTS responsable_reporte TEXT,
  ADD COLUMN IF NOT EXISTS responsable_monitoreo TEXT;
