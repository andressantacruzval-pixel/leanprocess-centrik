-- =============================================================================
-- LeanProcess Seed: Plan Limits
-- Version: 20260414000002
-- Description: Seeds plan limits for the canonical plans from 001_initial_schema.
--              Idempotent via WHERE NOT EXISTS.
-- =============================================================================

DO $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- ── free ──────────────────────────────────────────────────────────────────
  SELECT id INTO v_plan_id FROM plans WHERE name = 'free' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO plan_limits (plan_id, feature_key, limit_value)
    SELECT v_plan_id, t.fk, t.lv FROM (VALUES
      ('max_processes',           '5'),
      ('max_sipoc_per_process',   '1'),
      ('ai_tokens_monthly',       '10000'),
      ('export_bpmn',             'false'),
      ('export_pdf',              'false'),
      ('process_map',             'true'),
      ('process_characterization','false')
    ) AS t(fk, lv)
    WHERE NOT EXISTS (
      SELECT 1 FROM plan_limits pl WHERE pl.plan_id = v_plan_id AND pl.feature_key = t.fk
    );
  END IF;

  -- ── community ─────────────────────────────────────────────────────────────
  SELECT id INTO v_plan_id FROM plans WHERE name = 'community' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO plan_limits (plan_id, feature_key, limit_value)
    SELECT v_plan_id, t.fk, t.lv FROM (VALUES
      ('max_processes',           '20'),
      ('max_sipoc_per_process',   '3'),
      ('ai_tokens_monthly',       '50000'),
      ('export_bpmn',             'true'),
      ('export_pdf',              'true'),
      ('process_map',             'true'),
      ('process_characterization','true')
    ) AS t(fk, lv)
    WHERE NOT EXISTS (
      SELECT 1 FROM plan_limits pl WHERE pl.plan_id = v_plan_id AND pl.feature_key = t.fk
    );
  END IF;

  -- ── pro ───────────────────────────────────────────────────────────────────
  SELECT id INTO v_plan_id FROM plans WHERE name = 'pro' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO plan_limits (plan_id, feature_key, limit_value)
    SELECT v_plan_id, t.fk, t.lv FROM (VALUES
      ('max_processes',           'unlimited'),
      ('max_sipoc_per_process',   'unlimited'),
      ('ai_tokens_monthly',       '200000'),
      ('export_bpmn',             'true'),
      ('export_pdf',              'true'),
      ('process_map',             'true'),
      ('process_characterization','true')
    ) AS t(fk, lv)
    WHERE NOT EXISTS (
      SELECT 1 FROM plan_limits pl WHERE pl.plan_id = v_plan_id AND pl.feature_key = t.fk
    );
  END IF;

  -- ── max ───────────────────────────────────────────────────────────────────
  SELECT id INTO v_plan_id FROM plans WHERE name = 'max' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO plan_limits (plan_id, feature_key, limit_value)
    SELECT v_plan_id, t.fk, t.lv FROM (VALUES
      ('max_processes',           'unlimited'),
      ('max_sipoc_per_process',   'unlimited'),
      ('ai_tokens_monthly',       'unlimited'),
      ('export_bpmn',             'true'),
      ('export_pdf',              'true'),
      ('process_map',             'true'),
      ('process_characterization','true')
    ) AS t(fk, lv)
    WHERE NOT EXISTS (
      SELECT 1 FROM plan_limits pl WHERE pl.plan_id = v_plan_id AND pl.feature_key = t.fk
    );
  END IF;
END $$;
