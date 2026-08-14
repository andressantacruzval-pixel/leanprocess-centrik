-- Persiste los IDs de milestones de onboarding completados por empresa.
-- Valor ejemplo: '["company","org-structure","process-map"]'
-- Esto permite que al abrir desde otro dispositivo, el checklist de onboarding
-- refleje el progreso real sin depender de localStorage.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS milestone_completions JSONB NOT NULL DEFAULT '[]';
