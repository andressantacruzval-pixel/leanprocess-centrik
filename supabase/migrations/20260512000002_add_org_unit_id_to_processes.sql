-- Agrega la columna org_unit_id a processes.
-- Esta columna existía en 003_company_org_structure.sql (proyecto antiguo)
-- pero no fue incluida en la consolidación del proyecto nuevo (hucebvuhyedqbfhyzybo).
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS org_unit_id UUID
  REFERENCES org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processes_org_unit ON processes(org_unit_id);
