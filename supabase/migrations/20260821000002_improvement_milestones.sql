-- Hitos / subtareas delegables dentro de cada oportunidad de mejora.
-- Se guardan como JSONB embebido (checklist tipo Trello): array de
-- { id, title, responsible, done }. Simple y suficiente para el checklist.
ALTER TABLE public.improvement_opportunities
  ADD COLUMN IF NOT EXISTS milestones JSONB NOT NULL DEFAULT '[]'::jsonb;
