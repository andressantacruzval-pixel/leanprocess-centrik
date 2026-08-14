-- Cambiar FK org_units → org_level_definitions a ON DELETE SET NULL.
-- Con RESTRICT (comportamiento anterior), eliminar un nivel org desde la app
-- principal fallaba si había unidades que lo referenciaban. Con SET NULL, la
-- unidad pierde su asignación de nivel pero no bloquea la operación.
ALTER TABLE org_units
  DROP CONSTRAINT IF EXISTS org_units_org_level_definition_id_fkey;

ALTER TABLE org_units
  ADD CONSTRAINT org_units_org_level_definition_id_fkey
  FOREIGN KEY (org_level_definition_id)
  REFERENCES org_level_definitions(id)
  ON DELETE SET NULL;
