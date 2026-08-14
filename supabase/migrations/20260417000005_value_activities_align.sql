-- Paso 7 del plan — alinear CHECK de value_type con los valores que usa la app
-- (VA/NVA/NVABN) en lugar de los legacy VAC/VAN/NVA, y hacer company_id NOT NULL.
-- Tabla vacía, cambio directo.

ALTER TABLE public.value_activities
  DROP CONSTRAINT IF EXISTS value_activities_value_type_check;

ALTER TABLE public.value_activities
  ADD CONSTRAINT value_activities_value_type_check
  CHECK (value_type IN ('VA', 'NVA', 'NVABN'));

ALTER TABLE public.value_activities ALTER COLUMN company_id SET NOT NULL;
