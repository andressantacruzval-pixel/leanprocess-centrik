-- ============================================================================
-- RLS: memberships_select para visibilidad multi-miembro
-- ============================================================================
-- Antes: solo los owners veían la lista completa de miembros de su empresa.
-- Un miembro invitado (admin/editor/viewer) solo podía ver su propia fila,
-- lo que rompía la pantalla de "gestión de equipo" para cualquier no-owner.
--
-- Después: cualquier miembro activo de la empresa puede ver todas las
-- memberships de esa empresa (incluyendo el owner). La función
-- is_company_member(company_id) es SECURITY DEFINER, por lo que sus
-- consultas internas a memberships no disparan RLS recursiva.
--
-- Nota: las policies de INSERT/UPDATE/DELETE quedan igual — solo los
-- owners/editores pueden modificar memberships (is_company_editor).
-- ============================================================================

DROP POLICY IF EXISTS memberships_select ON memberships;
CREATE POLICY memberships_select ON memberships FOR SELECT
USING (
  user_id = auth.uid()
  OR is_company_member(company_id)
);
