-- ============================================
-- LEAN PROCESS — Initial Database Schema
-- ============================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PLANS & SUBSCRIPTIONS (Admin-configurable)
-- ============================================

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,             -- 'free', 'community', 'pro', 'max'
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) DEFAULT 0,
  price_yearly DECIMAL(10,2) DEFAULT 0,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plan_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,             -- 'max_processes', 'max_sipoc_per_process', 'ai_tokens_monthly', 'export_bpmn', 'export_pdf', 'export_image', 'process_map', 'process_characterization'
  limit_value TEXT NOT NULL,             -- numeric string or 'true'/'false' or 'unlimited'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, feature_key)
);

-- ============================================
-- 2. USER PROFILES
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan_id UUID REFERENCES plans(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  ai_tokens_used INT DEFAULT 0,
  ai_tokens_reset_at TIMESTAMPTZ DEFAULT NOW(),
  circle_member BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. MACRO PROCESSES (Process Map top-level)
-- ============================================

CREATE TYPE process_category AS ENUM ('estrategico', 'productivo', 'apoyo');

CREATE TABLE macroprocesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category process_category NOT NULL,
  sort_order INT DEFAULT 0,
  color TEXT,                            -- optional custom color
  icon TEXT,                             -- optional icon identifier
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. PROCESS LEVELS (dynamic, user-configurable)
-- ============================================

CREATE TABLE process_level_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  level_number INT NOT NULL,             -- 1, 2, 3...
  level_name TEXT NOT NULL,              -- 'Proceso', 'Subproceso', 'Actividad'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, level_number)
);

-- ============================================
-- 5. PROCESSES (the core entity)
-- ============================================

CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  macroprocess_id UUID REFERENCES macroprocesses(id) ON DELETE CASCADE,
  parent_process_id UUID REFERENCES processes(id) ON DELETE SET NULL,
  level_definition_id UUID REFERENCES process_level_definitions(id),

  -- Basic info
  name TEXT NOT NULL,
  code TEXT,                             -- optional internal code
  description TEXT,                      -- Objetivo/Descripcion

  -- Classification
  entity TEXT,                           -- Entidad del proceso
  process_type TEXT,                     -- Tipo de proceso (Productivo, etc.)
  execution_frequency TEXT,              -- Frecuencia ejecucion
  version TEXT,

  -- Organizational
  execution_level TEXT,                  -- Nivel de ejecucion
  management TEXT,                       -- Gerencia
  coordination TEXT,                     -- Jefatura/Coordinacion
  operative TEXT,                        -- Operativo
  business_line TEXT,                    -- Linea de negocio
  supervision_level TEXT,                -- Nivel de supervision
  responsible TEXT,                      -- Responsable
  delivery_method TEXT,                  -- Medio de entrega
  execution_type TEXT,                   -- Tipo de ejecucion

  -- Toggles
  is_critical BOOLEAN DEFAULT false,
  has_contingency_plan BOOLEAN DEFAULT false,
  involves_cash_movement BOOLEAN DEFAULT false,
  has_tax_operations BOOLEAN DEFAULT false,
  affects_accounting BOOLEAN DEFAULT false,
  handles_personal_data BOOLEAN DEFAULT false,
  provided_by_third_party BOOLEAN DEFAULT false,

  -- Metadata
  approval_date DATE,
  update_date DATE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. SIPOC
-- ============================================

CREATE TABLE sipoc_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE sipoc_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE sipoc_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES sipoc_suppliers(id) ON DELETE SET NULL,
  input_description TEXT,
  output_description TEXT,
  customer_id UUID REFERENCES sipoc_customers(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. BPMN DIAGRAMS
-- ============================================

CREATE TABLE bpmn_diagrams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Diagrama principal',
  diagram_json JSONB,                    -- React Flow JSON
  diagram_xml TEXT,                      -- BPMN 2.0 XML
  generated_by_ai BOOLEAN DEFAULT false,
  ai_prompt TEXT,                        -- prompt used to generate
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. AI USAGE LOG
-- ============================================

CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,                 -- 'sipoc_generation', 'bpmn_generation', 'description_generation'
  tokens_used INT NOT NULL,
  prompt_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. CONFIGURABLE DROPDOWNS / CATALOGS
-- ============================================

CREATE TABLE catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  catalog_type TEXT NOT NULL,            -- 'execution_level', 'management', 'coordination', 'business_line', 'supervision_level', 'delivery_method', 'execution_type', 'process_type', 'execution_frequency'
  value TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, catalog_type, value)
);

-- ============================================
-- 10. INDEXES
-- ============================================

CREATE INDEX idx_macroprocesses_user ON macroprocesses(user_id);
CREATE INDEX idx_processes_user ON processes(user_id);
CREATE INDEX idx_processes_macro ON processes(macroprocess_id);
CREATE INDEX idx_processes_parent ON processes(parent_process_id);
CREATE INDEX idx_sipoc_entries_process ON sipoc_entries(process_id);
CREATE INDEX idx_bpmn_diagrams_process ON bpmn_diagrams(process_id);
CREATE INDEX idx_ai_usage_user ON ai_usage_log(user_id);
CREATE INDEX idx_catalog_items_user_type ON catalog_items(user_id, catalog_type);
CREATE INDEX idx_plan_limits_plan ON plan_limits(plan_id);

-- ============================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE macroprocesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_level_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sipoc_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sipoc_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sipoc_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bpmn_diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users see own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own macroprocesses" ON macroprocesses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own level definitions" ON process_level_definitions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own processes" ON processes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own suppliers" ON sipoc_suppliers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own customers" ON sipoc_customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own sipoc" ON sipoc_entries FOR ALL USING (
  process_id IN (SELECT id FROM processes WHERE user_id = auth.uid())
);
CREATE POLICY "Users see own bpmn" ON bpmn_diagrams FOR ALL USING (
  process_id IN (SELECT id FROM processes WHERE user_id = auth.uid())
);
CREATE POLICY "Users see own ai log" ON ai_usage_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own catalogs" ON catalog_items FOR ALL USING (auth.uid() = user_id);

-- Plans are readable by everyone
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are public" ON plans FOR SELECT USING (true);
CREATE POLICY "Plan limits are public" ON plan_limits FOR SELECT USING (true);
-- Only admins can modify plans
CREATE POLICY "Admins manage plans" ON plans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins manage plan limits" ON plan_limits FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ============================================
-- 12. SEED DEFAULT PLANS
-- ============================================

INSERT INTO plans (name, display_name, description, price_monthly, price_yearly, sort_order) VALUES
  ('free', 'Free', 'Plan gratuito para explorar la herramienta', 0, 0, 1),
  ('community', 'Community', 'Para miembros de la comunidad Circle', 0, 0, 2),
  ('pro', 'Pro', 'Para profesionales y consultores', 19.99, 199.99, 3),
  ('max', 'Max', 'Acceso completo sin limites', 49.99, 499.99, 4);

-- Seed default limits for Free plan
INSERT INTO plan_limits (plan_id, feature_key, limit_value)
SELECT id, key, val FROM plans CROSS JOIN (VALUES
  ('max_processes', '5'),
  ('max_sipoc_per_process', '5'),
  ('ai_tokens_monthly', '10000'),
  ('export_bpmn', 'false'),
  ('export_pdf', 'false'),
  ('export_image', 'true'),
  ('process_map', 'true'),
  ('process_characterization', 'false')
) AS t(key, val)
WHERE plans.name = 'free';

-- Seed default limits for Community plan
INSERT INTO plan_limits (plan_id, feature_key, limit_value)
SELECT id, key, val FROM plans CROSS JOIN (VALUES
  ('max_processes', '15'),
  ('max_sipoc_per_process', '10'),
  ('ai_tokens_monthly', '50000'),
  ('export_bpmn', 'false'),
  ('export_pdf', 'true'),
  ('export_image', 'true'),
  ('process_map', 'true'),
  ('process_characterization', 'true')
) AS t(key, val)
WHERE plans.name = 'community';

-- Seed default limits for Pro plan
INSERT INTO plan_limits (plan_id, feature_key, limit_value)
SELECT id, key, val FROM plans CROSS JOIN (VALUES
  ('max_processes', '50'),
  ('max_sipoc_per_process', 'unlimited'),
  ('ai_tokens_monthly', '200000'),
  ('export_bpmn', 'true'),
  ('export_pdf', 'true'),
  ('export_image', 'true'),
  ('process_map', 'true'),
  ('process_characterization', 'true')
) AS t(key, val)
WHERE plans.name = 'pro';

-- Seed default limits for Max plan
INSERT INTO plan_limits (plan_id, feature_key, limit_value)
SELECT id, key, val FROM plans CROSS JOIN (VALUES
  ('max_processes', 'unlimited'),
  ('max_sipoc_per_process', 'unlimited'),
  ('ai_tokens_monthly', '1000000'),
  ('export_bpmn', 'true'),
  ('export_pdf', 'true'),
  ('export_image', 'true'),
  ('process_map', 'true'),
  ('process_characterization', 'true')
) AS t(key, val)
WHERE plans.name = 'max';

-- ============================================
-- 13. FUNCTION: Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, plan_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    (SELECT id FROM plans WHERE name = 'free')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
