CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  process_level_count INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_level_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  level_number INT NOT NULL,
  level_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, level_number)
);

CREATE TABLE org_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  org_level_definition_id UUID REFERENCES org_level_definitions(id),
  parent_id UUID REFERENCES org_units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE processes ADD COLUMN org_unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL;

CREATE INDEX idx_companies_user ON companies(user_id);
CREATE INDEX idx_org_level_defs_company ON org_level_definitions(company_id);
CREATE INDEX idx_org_units_company ON org_units(company_id);
CREATE INDEX idx_org_units_parent ON org_units(parent_id);
CREATE INDEX idx_processes_org_unit ON processes(org_unit_id);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_level_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company" ON companies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own org levels" ON org_level_definitions FOR ALL USING (
  company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);
CREATE POLICY "Users manage own org units" ON org_units FOR ALL USING (
  company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);
