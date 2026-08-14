-- ============================================================================
-- RPC reset_company: borra toda la información operativa de una empresa
-- y vuelve a poner onboarding_completed = false, sin eliminar la empresa.
-- Solo el owner puede ejecutarla (verificado via is_company_owner).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo el owner puede reiniciar su empresa
  IF NOT is_company_owner(p_company_id) THEN
    RAISE EXCEPTION 'No tienes permisos para reiniciar esta empresa';
  END IF;

  -- ── Tablas hijas (dependen de audit_items, procedure_steps, etc.) ────────
  DELETE FROM audit_items
    WHERE audit_id IN (
      SELECT id FROM audits WHERE company_id = p_company_id
    );

  DELETE FROM procedure_steps
    WHERE procedure_id IN (
      SELECT id FROM procedures WHERE company_id = p_company_id
    );

  DELETE FROM indicator_readings
    WHERE indicator_id IN (
      SELECT id FROM indicators WHERE company_id = p_company_id
    );

  DELETE FROM risk_controls
    WHERE risk_id IN (
      SELECT id FROM risks WHERE company_id = p_company_id
    );

  DELETE FROM bpmn_diagrams
    WHERE process_id IN (
      SELECT id FROM processes WHERE company_id = p_company_id
    );

  -- ── Tablas directas por company_id ────────────────────────────────────────
  DELETE FROM sipoc_entries      WHERE company_id = p_company_id;
  DELETE FROM value_activities   WHERE company_id = p_company_id;
  DELETE FROM change_log         WHERE company_id = p_company_id;
  DELETE FROM notifications      WHERE company_id = p_company_id;
  DELETE FROM catalog_items      WHERE company_id = p_company_id;
  DELETE FROM sipoc_suppliers    WHERE company_id = p_company_id;
  DELETE FROM sipoc_customers    WHERE company_id = p_company_id;

  DELETE FROM process_level_definitions WHERE company_id = p_company_id;
  DELETE FROM org_units                 WHERE company_id = p_company_id;
  DELETE FROM org_level_definitions     WHERE company_id = p_company_id;

  -- ── Datos de proceso (audits, procedures, indicators, risks primero
  --    para evitar conflictos de FK con las tablas ya eliminadas arriba) ────
  DELETE FROM audits           WHERE company_id = p_company_id;
  DELETE FROM procedures       WHERE company_id = p_company_id;
  DELETE FROM indicators       WHERE company_id = p_company_id;
  DELETE FROM risks            WHERE company_id = p_company_id;
  DELETE FROM processes        WHERE company_id = p_company_id;
  DELETE FROM macroprocesses   WHERE company_id = p_company_id;

  -- ── Reiniciar onboarding ──────────────────────────────────────────────────
  UPDATE companies
  SET onboarding_completed = false,
      updated_at = NOW()
  WHERE id = p_company_id;
END;
$$;

-- Solo usuarios autenticados pueden ejecutar la función.
-- La verificación de owner está dentro de la función.
GRANT EXECUTE ON FUNCTION public.reset_company(uuid) TO authenticated;
