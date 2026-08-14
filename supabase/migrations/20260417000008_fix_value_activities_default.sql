-- Corrige el default de value_activities.value_type: estaba 'VAC' (legacy)
-- pero el CHECK en 20260417000005_value_activities_align solo acepta 'VA','NVA','NVABN'.
-- Un INSERT que omitiera value_type fallaría por CHECK violation. (H-B del plan de validación)

ALTER TABLE public.value_activities ALTER COLUMN value_type SET DEFAULT 'NVA';
