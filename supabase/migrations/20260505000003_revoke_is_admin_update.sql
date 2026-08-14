-- Ningún usuario autenticado puede modificar su propio campo is_admin via API.
-- La asignación de admins se hace manualmente via Supabase Dashboard (Table Editor).
REVOKE UPDATE (is_admin) ON profiles FROM authenticated;
