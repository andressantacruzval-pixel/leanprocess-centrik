-- Ampliar ai_usage_log con métricas reales de tokens y modelo utilizado
ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS input_tokens INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ai_usage_log_company_idx ON ai_usage_log(company_id);
CREATE INDEX IF NOT EXISTS ai_usage_log_model_idx   ON ai_usage_log(model_used);
CREATE INDEX IF NOT EXISTS ai_usage_log_feature_idx ON ai_usage_log(feature);

-- Tabla de precios por modelo de IA (Tipo D: catálogo admin, SELECT público, escritura solo admins)
CREATE TABLE IF NOT EXISTS ai_model_prices (
  model_id              TEXT PRIMARY KEY,
  display_name          TEXT NOT NULL,
  input_price_per_1m    NUMERIC(10,6) NOT NULL DEFAULT 0,
  output_price_per_1m   NUMERIC(10,6) NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_model_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_model_prices"  ON ai_model_prices;
DROP POLICY IF EXISTS "admin_write_model_prices"  ON ai_model_prices;

CREATE POLICY "public_read_model_prices" ON ai_model_prices
  FOR SELECT USING (true);

CREATE POLICY "admin_write_model_prices" ON ai_model_prices
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Seed con precios aproximados de Gemini 2025 (actualizable desde el Admin Panel)
INSERT INTO ai_model_prices (model_id, display_name, input_price_per_1m, output_price_per_1m) VALUES
  ('gemini-2.5-flash',      'Gemini 2.5 Flash',      0.075000, 0.300000),
  ('gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', 0.040000, 0.150000)
ON CONFLICT (model_id) DO NOTHING;

-- Añadir operation_costs para feature IDs ya en uso en el código pero sin entrada en la tabla.
-- ON CONFLICT DO NOTHING para ser idempotente y no sobreescribir valores editados por admins.
INSERT INTO operation_costs (key, tokens, tier, description) VALUES
  ('kpi',                      10, 'media',  'Generación y sugerencia de KPIs'),
  ('risk',                     10, 'media',  'Identificación y sugerencia de riesgos'),
  ('audit',                    10, 'media',  'Programa de auditoría e ítems'),
  ('procedure',                10, 'media',  'Procedimiento desde imagen/diagrama'),
  ('bpmn_generation',          15, 'alta',   'Generación de diagrama BPMN'),
  ('bpmn_file_generation',     20, 'alta',   'BPMN desde archivo o imagen'),
  ('bpmn_refinement',          10, 'media',  'Refinamiento de diagrama BPMN'),
  ('bpmn_preprocess',           5, 'simple', 'Preprocesamiento de texto para BPMN'),
  ('procedure_image',          10, 'media',  'Procedimiento desde imagen multimodal'),
  ('procedure_risks',           5, 'simple', 'Riesgos rápidos desde procedimiento'),
  ('flowchart_interview_turn', 10, 'media',  'Turno de entrevista guiada de procesos'),
  ('advisor_chat_turn',        10, 'media',  'Turno de chat con consultor IA')
ON CONFLICT (key) DO NOTHING;
