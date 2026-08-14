-- =============================================================================
-- Fix: infinite recursion in profiles RLS policy
--
-- Causa: la política "profiles_select_admin" consultaba la propia tabla profiles
-- dentro de su condición USING, provocando recursión infinita en PostgreSQL.
-- Esto generaba HTTP 500 en cada GET /rest/v1/profiles.
--
-- Solución:
--   1. Eliminar la política recursiva "profiles_select_admin"
--   2. Envolver el chequeo de admin en una función SECURITY DEFINER (is_admin)
--      que bypassea RLS al consultar profiles
--   3. Actualizar las políticas de plans y plan_limits para usar is_admin()
-- =============================================================================

-- 1. Drop the self-referential policy causing infinite recursion
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;

-- 2. Create SECURITY DEFINER function to safely check admin status
--    (SECURITY DEFINER bypasses RLS, rompiendo el ciclo de recursión)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

-- 3. Fix plans policies: replace inline profiles query with is_admin()
DROP POLICY IF EXISTS "plans_all_admin"       ON plans;
DROP POLICY IF EXISTS "Admins manage plans"   ON plans;
CREATE POLICY "plans_all_admin" ON plans
  FOR ALL USING (is_admin());

-- 4. Fix plan_limits policies
DROP POLICY IF EXISTS "Admins manage plan limits" ON plan_limits;
DROP POLICY IF EXISTS "plan_limits_all_admin"     ON plan_limits;
CREATE POLICY "plan_limits_all_admin" ON plan_limits
  FOR ALL USING (is_admin());
