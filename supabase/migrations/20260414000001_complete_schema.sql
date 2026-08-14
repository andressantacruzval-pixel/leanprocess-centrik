-- =============================================================================
-- LeanProcess Complete Schema Migration
-- Version: 20260414000001
-- Description: Full idempotent schema covering all application tables,
--              RLS policies, helper functions, triggers, indexes, and storage.
-- =============================================================================

-- =============================================================================
-- SECTION 0: Extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- SECTION 1: Helper Functions
-- =============================================================================

-- Check if the current auth user is a member of the given company
CREATE OR REPLACE FUNCTION is_company_member(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM memberships
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
      AND status     = 'active'
  );
END;
$$;

-- Check if the current auth user is an editor (or higher) of the given company
CREATE OR REPLACE FUNCTION is_company_editor(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM memberships
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
      AND status     = 'active'
      AND role       IN ('owner', 'admin', 'editor')
  );
END;
$$;

-- Check if the current auth user is the owner of the given company
CREATE OR REPLACE FUNCTION is_company_owner(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM memberships
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
      AND status     = 'active'
      AND role       = 'owner'
  );
END;
$$;

-- =============================================================================
-- SECTION 2: companies
-- =============================================================================

-- Create companies table if it doesn't exist (it was created in 003_company_org_structure.sql)
CREATE TABLE IF NOT EXISTS companies (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  onboarding_completed  BOOLEAN     NOT NULL DEFAULT false,
  process_level_count   INT         NOT NULL DEFAULT 3,
  logo_url              TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add new columns if they don't exist (migration 003 didn't have these)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry       TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_size   TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country        TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description    TEXT;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Drop old user-scoped policy from migration 003 if it exists
DROP POLICY IF EXISTS "Users manage own company" ON companies;

DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_company_member(id)
  );

DROP POLICY IF EXISTS "companies_insert" ON companies;
CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "companies_update" ON companies;
CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (
    user_id = auth.uid()
    OR is_company_owner(id)
  );

DROP POLICY IF EXISTS "companies_delete" ON companies;
CREATE POLICY "companies_delete" ON companies
  FOR DELETE USING (
    user_id = auth.uid()
    OR is_company_owner(id)
  );

-- =============================================================================
-- SECTION 3: memberships
-- =============================================================================

CREATE TABLE IF NOT EXISTS memberships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  role        TEXT        NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member')),
  status      TEXT        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- memberships_select: avoid circular dependency (is_company_member queries memberships).
-- Users can see: their own membership row, OR all rows for companies they own.
DROP POLICY IF EXISTS "memberships_select" ON memberships;
CREATE POLICY "memberships_select" ON memberships
  FOR SELECT USING (
    user_id = auth.uid()
    OR company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  );

-- Only company owners (via companies.user_id) or existing editors may add members
DROP POLICY IF EXISTS "memberships_insert" ON memberships;
CREATE POLICY "memberships_insert" ON memberships
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "memberships_update" ON memberships;
CREATE POLICY "memberships_update" ON memberships
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "memberships_delete" ON memberships;
CREATE POLICY "memberships_delete" ON memberships
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

-- =============================================================================
-- SECTION 4: org_level_definitions & org_units
-- (Tables already exist from migration 003_company_org_structure, just update RLS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_level_definitions (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  level_number INT   NOT NULL,
  level_name   TEXT  NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, level_number)
);

ALTER TABLE org_level_definitions ENABLE ROW LEVEL SECURITY;

-- Drop old policies from migration 003
DROP POLICY IF EXISTS "Users see own org levels" ON org_level_definitions;

DROP POLICY IF EXISTS "org_level_definitions_select" ON org_level_definitions;
CREATE POLICY "org_level_definitions_select" ON org_level_definitions
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_member(company_id)
  );

DROP POLICY IF EXISTS "org_level_definitions_insert" ON org_level_definitions;
CREATE POLICY "org_level_definitions_insert" ON org_level_definitions
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "org_level_definitions_update" ON org_level_definitions;
CREATE POLICY "org_level_definitions_update" ON org_level_definitions
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "org_level_definitions_delete" ON org_level_definitions;
CREATE POLICY "org_level_definitions_delete" ON org_level_definitions
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

-- ---

CREATE TABLE IF NOT EXISTS org_units (
  id                       UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  org_level_definition_id  UUID  REFERENCES org_level_definitions(id) ON DELETE SET NULL,
  parent_id                UUID  REFERENCES org_units(id) ON DELETE SET NULL,
  name                     TEXT  NOT NULL,
  sort_order               INT   NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;

-- Drop old policies from migration 003
DROP POLICY IF EXISTS "Users manage own org units" ON org_units;

DROP POLICY IF EXISTS "org_units_select" ON org_units;
CREATE POLICY "org_units_select" ON org_units
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_member(company_id)
  );

DROP POLICY IF EXISTS "org_units_insert" ON org_units;
CREATE POLICY "org_units_insert" ON org_units
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "org_units_update" ON org_units;
CREATE POLICY "org_units_update" ON org_units
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "org_units_delete" ON org_units;
CREATE POLICY "org_units_delete" ON org_units
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    OR is_company_editor(company_id)
  );

-- =============================================================================
-- SECTION 5: Add company_id to existing tables
-- =============================================================================

ALTER TABLE macroprocesses
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE sipoc_suppliers
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE sipoc_customers
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE process_level_definitions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- =============================================================================
-- SECTION 6: risks & risk_controls
-- =============================================================================

CREATE TABLE IF NOT EXISTS risks (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id            UUID        NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  company_id            UUID        REFERENCES companies(id),
  process_step          TEXT,
  title                 TEXT        NOT NULL,
  risk_cause            TEXT,
  risk_event            TEXT,
  risk_effect           TEXT,
  description           TEXT,
  category              TEXT        NOT NULL DEFAULT 'Operacional',
  inherent_probability  INT         NOT NULL DEFAULT 3,
  inherent_impact       INT         NOT NULL DEFAULT 3,
  residual_probability  INT         NOT NULL DEFAULT 3,
  residual_impact       INT         NOT NULL DEFAULT 3,
  bpmn_element_id       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE risks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risks_select" ON risks;
CREATE POLICY "risks_select" ON risks
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "risks_insert" ON risks;
CREATE POLICY "risks_insert" ON risks
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "risks_update" ON risks;
CREATE POLICY "risks_update" ON risks
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "risks_delete" ON risks;
CREATE POLICY "risks_delete" ON risks
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- ---

CREATE TABLE IF NOT EXISTS risk_controls (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id       UUID        NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  description   TEXT,
  type          INT         NOT NULL DEFAULT 1,
  nature        INT         NOT NULL DEFAULT 1,
  doc           INT         NOT NULL DEFAULT 1,
  freq          INT         NOT NULL DEFAULT 1,
  evidence      INT         NOT NULL DEFAULT 1,
  segregation   INT         NOT NULL DEFAULT 1,
  training      INT         NOT NULL DEFAULT 1,
  monitoring    INT         NOT NULL DEFAULT 1,
  mitigates     TEXT        NOT NULL DEFAULT 'Ambos',
  score         INT         NOT NULL DEFAULT 8,
  effectiveness TEXT        NOT NULL DEFAULT 'Deficiente',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE risk_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risk_controls_select" ON risk_controls;
CREATE POLICY "risk_controls_select" ON risk_controls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_controls.risk_id
        AND r.company_id IS NOT NULL
        AND is_company_member(r.company_id)
    )
  );

DROP POLICY IF EXISTS "risk_controls_insert" ON risk_controls;
CREATE POLICY "risk_controls_insert" ON risk_controls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_controls.risk_id
        AND r.company_id IS NOT NULL
        AND is_company_editor(r.company_id)
    )
  );

DROP POLICY IF EXISTS "risk_controls_update" ON risk_controls;
CREATE POLICY "risk_controls_update" ON risk_controls
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_controls.risk_id
        AND r.company_id IS NOT NULL
        AND is_company_editor(r.company_id)
    )
  );

DROP POLICY IF EXISTS "risk_controls_delete" ON risk_controls;
CREATE POLICY "risk_controls_delete" ON risk_controls
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM risks r
      WHERE r.id = risk_controls.risk_id
        AND r.company_id IS NOT NULL
        AND is_company_editor(r.company_id)
    )
  );

-- =============================================================================
-- SECTION 7: indicators & indicator_readings
-- =============================================================================

CREATE TABLE IF NOT EXISTS indicators (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id       UUID        REFERENCES processes(id) ON DELETE SET NULL,
  company_id       UUID        NOT NULL REFERENCES companies(id),
  name             TEXT        NOT NULL,
  code             TEXT,
  description      TEXT,
  formula          TEXT,
  unit             TEXT,
  frequency        TEXT,
  target_value     DECIMAL,
  min_acceptable   DECIMAL,
  max_acceptable   DECIMAL,
  owner            TEXT,
  data_source      TEXT,
  category         TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "indicators_select" ON indicators;
CREATE POLICY "indicators_select" ON indicators
  FOR SELECT USING (is_company_member(company_id));

DROP POLICY IF EXISTS "indicators_insert" ON indicators;
CREATE POLICY "indicators_insert" ON indicators
  FOR INSERT WITH CHECK (is_company_editor(company_id));

DROP POLICY IF EXISTS "indicators_update" ON indicators;
CREATE POLICY "indicators_update" ON indicators
  FOR UPDATE USING (is_company_editor(company_id));

DROP POLICY IF EXISTS "indicators_delete" ON indicators;
CREATE POLICY "indicators_delete" ON indicators
  FOR DELETE USING (is_company_editor(company_id));

-- ---

CREATE TABLE IF NOT EXISTS indicator_readings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id  UUID        NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  period        TEXT,
  value         DECIMAL,
  notes         TEXT,
  recorded_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE indicator_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "indicator_readings_select" ON indicator_readings;
CREATE POLICY "indicator_readings_select" ON indicator_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM indicators i
      WHERE i.id = indicator_readings.indicator_id
        AND is_company_member(i.company_id)
    )
  );

DROP POLICY IF EXISTS "indicator_readings_insert" ON indicator_readings;
CREATE POLICY "indicator_readings_insert" ON indicator_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM indicators i
      WHERE i.id = indicator_readings.indicator_id
        AND is_company_editor(i.company_id)
    )
  );

DROP POLICY IF EXISTS "indicator_readings_update" ON indicator_readings;
CREATE POLICY "indicator_readings_update" ON indicator_readings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM indicators i
      WHERE i.id = indicator_readings.indicator_id
        AND is_company_editor(i.company_id)
    )
  );

DROP POLICY IF EXISTS "indicator_readings_delete" ON indicator_readings;
CREATE POLICY "indicator_readings_delete" ON indicator_readings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM indicators i
      WHERE i.id = indicator_readings.indicator_id
        AND is_company_editor(i.company_id)
    )
  );

-- =============================================================================
-- SECTION 8: procedures & procedure_steps
-- =============================================================================

CREATE TABLE IF NOT EXISTS procedures (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id    UUID        UNIQUE REFERENCES processes(id) ON DELETE CASCADE,
  company_id    UUID        REFERENCES companies(id),
  title         TEXT,
  objective     TEXT,
  scope         TEXT,
  responsible   TEXT,
  version       TEXT        NOT NULL DEFAULT '1.0',
  status        TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'review', 'approved')),
  approved_by   TEXT,
  approval_date DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "procedures_select" ON procedures;
CREATE POLICY "procedures_select" ON procedures
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "procedures_insert" ON procedures;
CREATE POLICY "procedures_insert" ON procedures
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "procedures_update" ON procedures;
CREATE POLICY "procedures_update" ON procedures
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "procedures_delete" ON procedures;
CREATE POLICY "procedures_delete" ON procedures
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- ---

CREATE TABLE IF NOT EXISTS procedure_steps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id  UUID        NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  step_number   INT,
  title         TEXT,
  description   TEXT,
  responsible   TEXT,
  duration      TEXT,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE procedure_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "procedure_steps_select" ON procedure_steps;
CREATE POLICY "procedure_steps_select" ON procedure_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM procedures p
      WHERE p.id = procedure_steps.procedure_id
        AND p.company_id IS NOT NULL
        AND is_company_member(p.company_id)
    )
  );

DROP POLICY IF EXISTS "procedure_steps_insert" ON procedure_steps;
CREATE POLICY "procedure_steps_insert" ON procedure_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM procedures p
      WHERE p.id = procedure_steps.procedure_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

DROP POLICY IF EXISTS "procedure_steps_update" ON procedure_steps;
CREATE POLICY "procedure_steps_update" ON procedure_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM procedures p
      WHERE p.id = procedure_steps.procedure_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

DROP POLICY IF EXISTS "procedure_steps_delete" ON procedure_steps;
CREATE POLICY "procedure_steps_delete" ON procedure_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM procedures p
      WHERE p.id = procedure_steps.procedure_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

-- =============================================================================
-- SECTION 9: audits & audit_items
-- =============================================================================

CREATE TABLE IF NOT EXISTS audits (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id     UUID        NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  company_id     UUID        REFERENCES companies(id),
  auditor        TEXT,
  audit_date     DATE,
  status         TEXT        NOT NULL DEFAULT 'pendiente'
                   CHECK (status IN ('pendiente', 'en_proceso', 'completado')),
  overall_score  DECIMAL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audits_select" ON audits;
CREATE POLICY "audits_select" ON audits
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "audits_insert" ON audits;
CREATE POLICY "audits_insert" ON audits
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "audits_update" ON audits;
CREATE POLICY "audits_update" ON audits
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "audits_delete" ON audits;
CREATE POLICY "audits_delete" ON audits
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- ---

CREATE TABLE IF NOT EXISTS audit_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     UUID        NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  criterion    TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pendiente',
  score        INT,
  observation  TEXT,
  evidence     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_items_select" ON audit_items;
CREATE POLICY "audit_items_select" ON audit_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = audit_items.audit_id
        AND a.company_id IS NOT NULL
        AND is_company_member(a.company_id)
    )
  );

DROP POLICY IF EXISTS "audit_items_insert" ON audit_items;
CREATE POLICY "audit_items_insert" ON audit_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = audit_items.audit_id
        AND a.company_id IS NOT NULL
        AND is_company_editor(a.company_id)
    )
  );

DROP POLICY IF EXISTS "audit_items_update" ON audit_items;
CREATE POLICY "audit_items_update" ON audit_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = audit_items.audit_id
        AND a.company_id IS NOT NULL
        AND is_company_editor(a.company_id)
    )
  );

DROP POLICY IF EXISTS "audit_items_delete" ON audit_items;
CREATE POLICY "audit_items_delete" ON audit_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = audit_items.audit_id
        AND a.company_id IS NOT NULL
        AND is_company_editor(a.company_id)
    )
  );

-- =============================================================================
-- SECTION 10: value_activities
-- =============================================================================

CREATE TABLE IF NOT EXISTS value_activities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id   UUID        NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  company_id   UUID        REFERENCES companies(id),
  name         TEXT        NOT NULL,
  value_type   TEXT        NOT NULL DEFAULT 'VAC'
                 CHECK (value_type IN ('VAC', 'VAN', 'NVA')),
  time_minutes INT         NOT NULL DEFAULT 0,
  cost         DECIMAL     NOT NULL DEFAULT 0,
  responsible  TEXT,
  sequence     INT         NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE value_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "value_activities_select" ON value_activities;
CREATE POLICY "value_activities_select" ON value_activities
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "value_activities_insert" ON value_activities;
CREATE POLICY "value_activities_insert" ON value_activities
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "value_activities_update" ON value_activities;
CREATE POLICY "value_activities_update" ON value_activities
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "value_activities_delete" ON value_activities;
CREATE POLICY "value_activities_delete" ON value_activities
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- =============================================================================
-- SECTION 11: change_log
-- =============================================================================

CREATE TABLE IF NOT EXISTS change_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id   UUID        NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  company_id   UUID        REFERENCES companies(id),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action       TEXT        NOT NULL,
  description  TEXT,
  author_name  TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "change_log_select" ON change_log;
CREATE POLICY "change_log_select" ON change_log
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "change_log_insert" ON change_log;
CREATE POLICY "change_log_insert" ON change_log
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

-- No UPDATE or DELETE on change_log — immutable audit trail

-- =============================================================================
-- SECTION 12: subscriptions & company_addons
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID        NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  plan_id               UUID        REFERENCES plans(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'trial'
                          CHECK (status IN ('trial', 'active', 'canceled', 'past_due')),
  interval              TEXT        NOT NULL DEFAULT 'monthly',
  base_price            DECIMAL,
  currency              TEXT        NOT NULL DEFAULT 'USD',
  provider              TEXT        NOT NULL DEFAULT 'none',
  provider_ref          TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN     NOT NULL DEFAULT false,
  trial_ends_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (is_company_member(company_id));

DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
CREATE POLICY "subscriptions_insert" ON subscriptions
  FOR INSERT WITH CHECK (is_company_owner(company_id));

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE USING (is_company_owner(company_id));

-- ---

CREATE TABLE IF NOT EXISTS company_addons (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL
                 CHECK (type IN ('extra_company', 'extra_member', 'extra_ai_tokens')),
  quantity     INT         NOT NULL DEFAULT 1,
  unit_price   DECIMAL,
  currency     TEXT        NOT NULL DEFAULT 'USD',
  interval     TEXT        NOT NULL DEFAULT 'monthly',
  status       TEXT        NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'canceled')),
  provider     TEXT,
  provider_ref TEXT,
  canceled_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE company_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_addons_select" ON company_addons;
CREATE POLICY "company_addons_select" ON company_addons
  FOR SELECT USING (is_company_member(company_id));

DROP POLICY IF EXISTS "company_addons_insert" ON company_addons;
CREATE POLICY "company_addons_insert" ON company_addons
  FOR INSERT WITH CHECK (is_company_owner(company_id));

DROP POLICY IF EXISTS "company_addons_update" ON company_addons;
CREATE POLICY "company_addons_update" ON company_addons
  FOR UPDATE USING (is_company_owner(company_id));

-- =============================================================================
-- SECTION 13: notifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  UUID        REFERENCES companies(id),
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT,
  link        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

-- =============================================================================
-- SECTION 14: RLS for bpmn_diagrams
-- =============================================================================

ALTER TABLE bpmn_diagrams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bpmn_diagrams_select" ON bpmn_diagrams;
CREATE POLICY "bpmn_diagrams_select" ON bpmn_diagrams
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM processes p
      WHERE p.id = bpmn_diagrams.process_id
        AND p.company_id IS NOT NULL
        AND is_company_member(p.company_id)
    )
  );

DROP POLICY IF EXISTS "bpmn_diagrams_insert" ON bpmn_diagrams;
CREATE POLICY "bpmn_diagrams_insert" ON bpmn_diagrams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM processes p
      WHERE p.id = bpmn_diagrams.process_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

DROP POLICY IF EXISTS "bpmn_diagrams_update" ON bpmn_diagrams;
CREATE POLICY "bpmn_diagrams_update" ON bpmn_diagrams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM processes p
      WHERE p.id = bpmn_diagrams.process_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

DROP POLICY IF EXISTS "bpmn_diagrams_delete" ON bpmn_diagrams;
CREATE POLICY "bpmn_diagrams_delete" ON bpmn_diagrams
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM processes p
      WHERE p.id = bpmn_diagrams.process_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

-- =============================================================================
-- SECTION 15: RLS for ai_usage_log
-- =============================================================================

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_log_select" ON ai_usage_log;
CREATE POLICY "ai_usage_log_select" ON ai_usage_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_usage_log_insert" ON ai_usage_log;
CREATE POLICY "ai_usage_log_insert" ON ai_usage_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- SECTION 16: RLS for profiles
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM memberships m1
      JOIN memberships m2 ON m1.company_id = m2.company_id
      WHERE m1.user_id = auth.uid()
        AND m2.user_id = profiles.id
        AND m1.status  = 'active'
        AND m2.status  = 'active'
    )
  );

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- SECTION 17: RLS for macroprocesses, processes, sipoc_*, catalog_items,
--             process_level_definitions
-- =============================================================================

-- macroprocesses
ALTER TABLE macroprocesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "macroprocesses_select" ON macroprocesses;
CREATE POLICY "macroprocesses_select" ON macroprocesses
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "macroprocesses_insert" ON macroprocesses;
CREATE POLICY "macroprocesses_insert" ON macroprocesses
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "macroprocesses_update" ON macroprocesses;
CREATE POLICY "macroprocesses_update" ON macroprocesses
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "macroprocesses_delete" ON macroprocesses;
CREATE POLICY "macroprocesses_delete" ON macroprocesses
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- processes
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "processes_select" ON processes;
CREATE POLICY "processes_select" ON processes
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "processes_insert" ON processes;
CREATE POLICY "processes_insert" ON processes
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "processes_update" ON processes;
CREATE POLICY "processes_update" ON processes
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "processes_delete" ON processes;
CREATE POLICY "processes_delete" ON processes
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- sipoc_suppliers
ALTER TABLE sipoc_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sipoc_suppliers_select" ON sipoc_suppliers;
CREATE POLICY "sipoc_suppliers_select" ON sipoc_suppliers
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "sipoc_suppliers_insert" ON sipoc_suppliers;
CREATE POLICY "sipoc_suppliers_insert" ON sipoc_suppliers
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "sipoc_suppliers_update" ON sipoc_suppliers;
CREATE POLICY "sipoc_suppliers_update" ON sipoc_suppliers
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "sipoc_suppliers_delete" ON sipoc_suppliers;
CREATE POLICY "sipoc_suppliers_delete" ON sipoc_suppliers
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- sipoc_customers
ALTER TABLE sipoc_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sipoc_customers_select" ON sipoc_customers;
CREATE POLICY "sipoc_customers_select" ON sipoc_customers
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "sipoc_customers_insert" ON sipoc_customers;
CREATE POLICY "sipoc_customers_insert" ON sipoc_customers
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "sipoc_customers_update" ON sipoc_customers;
CREATE POLICY "sipoc_customers_update" ON sipoc_customers
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "sipoc_customers_delete" ON sipoc_customers;
CREATE POLICY "sipoc_customers_delete" ON sipoc_customers
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- sipoc_entries
ALTER TABLE sipoc_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sipoc_entries_select" ON sipoc_entries;
CREATE POLICY "sipoc_entries_select" ON sipoc_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM processes p
      WHERE p.id = sipoc_entries.process_id
        AND p.company_id IS NOT NULL
        AND is_company_member(p.company_id)
    )
  );

DROP POLICY IF EXISTS "sipoc_entries_insert" ON sipoc_entries;
CREATE POLICY "sipoc_entries_insert" ON sipoc_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM processes p
      WHERE p.id = sipoc_entries.process_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

DROP POLICY IF EXISTS "sipoc_entries_update" ON sipoc_entries;
CREATE POLICY "sipoc_entries_update" ON sipoc_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM processes p
      WHERE p.id = sipoc_entries.process_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

DROP POLICY IF EXISTS "sipoc_entries_delete" ON sipoc_entries;
CREATE POLICY "sipoc_entries_delete" ON sipoc_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM processes p
      WHERE p.id = sipoc_entries.process_id
        AND p.company_id IS NOT NULL
        AND is_company_editor(p.company_id)
    )
  );

-- catalog_items
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_items_select" ON catalog_items;
CREATE POLICY "catalog_items_select" ON catalog_items
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "catalog_items_insert" ON catalog_items;
CREATE POLICY "catalog_items_insert" ON catalog_items
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "catalog_items_update" ON catalog_items;
CREATE POLICY "catalog_items_update" ON catalog_items
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "catalog_items_delete" ON catalog_items;
CREATE POLICY "catalog_items_delete" ON catalog_items
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- process_level_definitions
ALTER TABLE process_level_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "process_level_definitions_select" ON process_level_definitions;
CREATE POLICY "process_level_definitions_select" ON process_level_definitions
  FOR SELECT USING (
    company_id IS NOT NULL AND is_company_member(company_id)
  );

DROP POLICY IF EXISTS "process_level_definitions_insert" ON process_level_definitions;
CREATE POLICY "process_level_definitions_insert" ON process_level_definitions
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "process_level_definitions_update" ON process_level_definitions;
CREATE POLICY "process_level_definitions_update" ON process_level_definitions
  FOR UPDATE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

DROP POLICY IF EXISTS "process_level_definitions_delete" ON process_level_definitions;
CREATE POLICY "process_level_definitions_delete" ON process_level_definitions
  FOR DELETE USING (
    company_id IS NOT NULL AND is_company_editor(company_id)
  );

-- =============================================================================
-- SECTION 18: Storage buckets & storage RLS
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',           'avatars',           true,  5242880,   ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('company-assets',    'company-assets',    true,  10485760,  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('bpmn-diagrams',     'bpmn-diagrams',     false, 10485760,  ARRAY['application/xml','text/xml','application/json']),
  ('procedure-exports', 'procedure-exports', false, 52428800,  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies: avatars (public read, owner write)
DROP POLICY IF EXISTS "avatars_public_select"  ON storage.objects;
CREATE POLICY "avatars_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
CREATE POLICY "avatars_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- Storage policies: company-assets (public read, editor write)
DROP POLICY IF EXISTS "company_assets_public_select" ON storage.objects;
CREATE POLICY "company_assets_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-assets');

DROP POLICY IF EXISTS "company_assets_auth_insert" ON storage.objects;
CREATE POLICY "company_assets_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-assets' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "company_assets_auth_update" ON storage.objects;
CREATE POLICY "company_assets_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'company-assets' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "company_assets_auth_delete" ON storage.objects;
CREATE POLICY "company_assets_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-assets' AND auth.uid() IS NOT NULL
  );

-- Storage policies: bpmn-diagrams (private — company member)
DROP POLICY IF EXISTS "bpmn_diagrams_storage_select" ON storage.objects;
CREATE POLICY "bpmn_diagrams_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bpmn-diagrams' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "bpmn_diagrams_storage_insert" ON storage.objects;
CREATE POLICY "bpmn_diagrams_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bpmn-diagrams' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "bpmn_diagrams_storage_update" ON storage.objects;
CREATE POLICY "bpmn_diagrams_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'bpmn-diagrams' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "bpmn_diagrams_storage_delete" ON storage.objects;
CREATE POLICY "bpmn_diagrams_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'bpmn-diagrams' AND auth.uid() IS NOT NULL
  );

-- Storage policies: procedure-exports (private — company member)
DROP POLICY IF EXISTS "procedure_exports_storage_select" ON storage.objects;
CREATE POLICY "procedure_exports_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'procedure-exports' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "procedure_exports_storage_insert" ON storage.objects;
CREATE POLICY "procedure_exports_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'procedure-exports' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "procedure_exports_storage_update" ON storage.objects;
CREATE POLICY "procedure_exports_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'procedure-exports' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "procedure_exports_storage_delete" ON storage.objects;
CREATE POLICY "procedure_exports_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'procedure-exports' AND auth.uid() IS NOT NULL
  );

-- =============================================================================
-- SECTION 19: Triggers
-- =============================================================================

-- set_updated_at: generic trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply set_updated_at to every table that has an updated_at column
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'companies',
    'memberships',
    'org_units',
    'risks',
    'risk_controls',
    'indicators',
    'procedures',
    'procedure_steps',
    'audits',
    'audit_items',
    'value_activities',
    'subscriptions',
    'company_addons',
    'macroprocesses',
    'processes',
    'sipoc_suppliers',
    'sipoc_customers',
    'catalog_items',
    'process_level_definitions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- handle_new_user: create a profile row when a user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- SECTION 20: Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_memberships_user_id
  ON memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_memberships_company_id
  ON memberships (company_id);

CREATE INDEX IF NOT EXISTS idx_processes_company_id
  ON processes (company_id);

CREATE INDEX IF NOT EXISTS idx_macroprocesses_company_id
  ON macroprocesses (company_id);

CREATE INDEX IF NOT EXISTS idx_risks_process_id
  ON risks (process_id);

CREATE INDEX IF NOT EXISTS idx_risks_company_id
  ON risks (company_id);

CREATE INDEX IF NOT EXISTS idx_indicators_company_id
  ON indicators (company_id);

CREATE INDEX IF NOT EXISTS idx_change_log_process_id
  ON change_log (process_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read
  ON notifications (read);
