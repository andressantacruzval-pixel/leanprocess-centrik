-- Agrega la columna reporter a indicators.
-- El campo existía solo en localStorage (indicatorStore); se persiste ahora en DB.
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS reporter text NOT NULL DEFAULT '';
