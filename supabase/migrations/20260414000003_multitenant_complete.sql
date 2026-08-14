-- ============================================================
-- LeanProcess — Migration: Multi-tenant Complete (fixed)
-- Runs after 000001 which created the main tables.
-- This migration: updates RLS helper functions, populates
-- memberships from existing companies, creates storage buckets,
-- and adds updated_at triggers.
-- All table creation uses IF NOT EXISTS to be idempotent.
-- ============================================================

-- ─── Section 1: Update helper functions (fix param names) ──────────────

-- 000001 already created these with p_company_id parameter.
-- We update them here to also check companies.user_id (owner bypass).

CREATE OR REPLACE FUNCTION is_company_member(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM companies
    WHERE id = p_company_id AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_company_editor(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin', 'editor')
  ) OR EXISTS (
    SELECT 1 FROM companies
    WHERE id = p_company_id AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_company_owner(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role = 'owner'
  ) OR EXISTS (
    SELECT 1 FROM companies
    WHERE id = p_company_id AND user_id = auth.uid()
  );
END;
$$;

-- ─── Section 2: Populate memberships for existing company owners ────────
-- (000001 created the memberships table; now seed it from companies.user_id)

INSERT INTO memberships (company_id, user_id, email, role, status)
SELECT
  c.id,
  c.user_id,
  COALESCE(p.email, 'unknown@leanprocess.app'),
  'owner',
  'active'
FROM companies c
LEFT JOIN profiles p ON p.id = c.user_id
WHERE c.user_id IS NOT NULL
ON CONFLICT (company_id, email) DO NOTHING;

-- ─── Section 3: Add company_id index to existing tables (if needed) ─────

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company_id ON memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_org_level_defs_company ON org_level_definitions(company_id);
CREATE INDEX IF NOT EXISTS idx_org_units_company ON org_units(company_id);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON org_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_procedures_process ON procedures(process_id);
CREATE INDEX IF NOT EXISTS idx_procedures_company ON procedures(company_id);
CREATE INDEX IF NOT EXISTS idx_procedure_steps_procedure ON procedure_steps(procedure_id);
CREATE INDEX IF NOT EXISTS idx_audits_process ON audits(process_id);
CREATE INDEX IF NOT EXISTS idx_audits_company ON audits(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_audit ON audit_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_value_activities_process ON value_activities(process_id);
CREATE INDEX IF NOT EXISTS idx_value_activities_company ON value_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_change_log_process ON change_log(process_id);
CREATE INDEX IF NOT EXISTS idx_change_log_company ON change_log(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ─── Section 4: Add company_id to process_indicators (if missing) ───────
-- process_indicators was created in 002_indicators.sql without company_id.
-- Add it so we can scope it by company.

ALTER TABLE process_indicators
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ─── Section 5: Storage buckets ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',           'avatars',           true,  5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('company-assets',    'company-assets',    true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('bpmn-diagrams',     'bpmn-diagrams',     false, 10485760, ARRAY['application/xml','text/xml','application/json']),
  ('procedure-exports', 'procedure-exports', false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "avatars_public_read"     ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_upload"     ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_update"     ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_delete"     ON storage.objects;
DROP POLICY IF EXISTS "company_assets_read"     ON storage.objects;
DROP POLICY IF EXISTS "company_assets_write"    ON storage.objects;
DROP POLICY IF EXISTS "bpmn_auth_read"          ON storage.objects;
DROP POLICY IF EXISTS "bpmn_auth_write"         ON storage.objects;
DROP POLICY IF EXISTS "exports_auth_read"       ON storage.objects;
DROP POLICY IF EXISTS "exports_auth_write"      ON storage.objects;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "company_assets_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "bpmn_auth_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bpmn-diagrams'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "bpmn_auth_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bpmn-diagrams'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "exports_auth_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'procedure-exports'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "exports_auth_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'procedure-exports'
    AND auth.role() = 'authenticated'
  );

-- ─── Section 6: updated_at trigger for new tables ──────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships', 'org_units', 'subscriptions',
    'procedures', 'procedure_steps', 'audits', 'audit_items',
    'value_activities', 'risks', 'risk_controls', 'indicators',
    'change_log'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END $$;
