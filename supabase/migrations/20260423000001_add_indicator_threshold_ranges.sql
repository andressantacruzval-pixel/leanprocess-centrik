-- Agrega columnas de rango min/max para el semáforo de indicadores.
-- Reemplaza los campos de texto libre (threshold_green/yellow/red) que
-- vivían solo en localStorage por valores numéricos persistidos en DB.

ALTER TABLE public.indicators
  ADD COLUMN IF NOT EXISTS threshold_green_min  DECIMAL,
  ADD COLUMN IF NOT EXISTS threshold_green_max  DECIMAL,
  ADD COLUMN IF NOT EXISTS threshold_yellow_min DECIMAL,
  ADD COLUMN IF NOT EXISTS threshold_yellow_max DECIMAL,
  ADD COLUMN IF NOT EXISTS threshold_red_min    DECIMAL,
  ADD COLUMN IF NOT EXISTS threshold_red_max    DECIMAL;
