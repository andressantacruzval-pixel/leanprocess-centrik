-- Tabla para persistir el histórico semanal de métricas de empresa.
-- Reemplaza el almacenamiento exclusivo en localStorage de dashboardSnapshotStore.
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date timestamptz NOT NULL,
  macro_count int NOT NULL DEFAULT 0,
  process_count int NOT NULL DEFAULT 0,
  bpmn_count int NOT NULL DEFAULT 0,
  procedure_count int NOT NULL DEFAULT 0,
  total_risks int NOT NULL DEFAULT 0,
  total_controls int NOT NULL DEFAULT 0,
  total_kpis int NOT NULL DEFAULT 0,
  total_audit_items int NOT NULL DEFAULT 0,
  va_efficiency numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read snapshots"
  ON dashboard_snapshots FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "editors insert snapshots"
  ON dashboard_snapshots FOR INSERT
  WITH CHECK (is_company_editor(company_id));

CREATE POLICY "editors update snapshots"
  ON dashboard_snapshots FOR UPDATE
  USING (is_company_editor(company_id));
