-- Agrega columnas faltantes en procedures, procedure_steps y sipoc_entries
-- que el código de la app envía pero que no existían en la DB.

-- procedures: definitions y references que usa ProcedureData del servicio
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS definitions  TEXT,
  ADD COLUMN IF NOT EXISTS "references" TEXT;

-- procedure_steps: el servicio envía duration_minutes (INT), inputs, outputs, observations
-- La columna 'duration' (TEXT) ya existe; agregamos las nuevas sin eliminar la antigua
ALTER TABLE public.procedure_steps
  ADD COLUMN IF NOT EXISTS duration_minutes INT,
  ADD COLUMN IF NOT EXISTS inputs          TEXT,
  ADD COLUMN IF NOT EXISTS outputs         TEXT,
  ADD COLUMN IF NOT EXISTS observations    TEXT;

-- sipoc_entries: el store envía supplier_name, customer_name y company_id para display
-- sin necesitar hacer joins a sipoc_suppliers / sipoc_customers
ALTER TABLE public.sipoc_entries
  ADD COLUMN IF NOT EXISTS company_id    UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT;
