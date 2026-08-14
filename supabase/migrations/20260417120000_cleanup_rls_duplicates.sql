-- ============================================================================
-- Limpieza de policies RLS duplicadas en companies y processes
-- ============================================================================
-- Contexto: la tabla `processes` tenía una policy ALL (processes_crud_own)
-- que exigía user_id = auth.uid() además de las policies específicas basadas
-- en is_company_member/editor. PostgreSQL aplica todas las policies de INSERT
-- como restricción combinada, bloqueando silenciosamente inserts válidos
-- de miembros de empresa que no fueran el owner directo.
--
-- Igual caso con companies: las policies *_own duplicaban la lógica de las
-- policies principales, agregando restricciones redundantes que confunden
-- el modelo de autorización.
--
-- Tras esta migración quedan SOLO las policies _select/_insert/_update/_delete
-- basadas en is_company_member / is_company_editor (ambas con SECURITY DEFINER).
-- ============================================================================

-- ─── companies ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS companies_select_own ON companies;
DROP POLICY IF EXISTS companies_insert_own ON companies;
DROP POLICY IF EXISTS companies_update_own ON companies;
DROP POLICY IF EXISTS companies_delete_own ON companies;

-- ─── processes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS processes_crud_own ON processes;
