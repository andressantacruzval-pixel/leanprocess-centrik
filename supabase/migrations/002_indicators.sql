-- Process Indicators table
CREATE TABLE process_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT,
  formula TEXT,
  data_source TEXT,
  unit_of_measure TEXT,
  frequency TEXT,
  target_value TEXT,
  threshold_green TEXT,
  threshold_yellow TEXT,
  threshold_red TEXT,
  responsible_report TEXT,
  responsible_monitoring TEXT,
  definition_date DATE,
  is_active BOOLEAN DEFAULT true,
  generated_by_ai BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_indicators_process ON process_indicators(process_id);
CREATE INDEX idx_indicators_user ON process_indicators(user_id);

ALTER TABLE process_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own indicators" ON process_indicators FOR ALL USING (auth.uid() = user_id);
