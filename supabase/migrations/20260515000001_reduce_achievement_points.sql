-- Reducir puntos de todos los logros ÷5 y eliminar logros de comunidad no funcionales
-- Máximo anterior: 1,145 pts (26 logros) → Máximo nuevo: ~187 pts (24 logros)

UPDATE public.achievements SET points = 2  WHERE id = 'first-process';
UPDATE public.achievements SET points = 5  WHERE id = 'five-processes';
UPDATE public.achievements SET points = 10 WHERE id = 'ten-processes';
UPDATE public.achievements SET points = 20 WHERE id = 'twenty-processes';
UPDATE public.achievements SET points = 3  WHERE id = 'first-bpmn';
UPDATE public.achievements SET points = 10 WHERE id = 'five-bpmn';
UPDATE public.achievements SET points = 2  WHERE id = 'first-risk';
UPDATE public.achievements SET points = 8  WHERE id = 'ten-risks';
UPDATE public.achievements SET points = 3  WHERE id = 'first-control';
UPDATE public.achievements SET points = 10 WHERE id = 'ten-controls';
UPDATE public.achievements SET points = 3  WHERE id = 'first-procedure';
UPDATE public.achievements SET points = 8  WHERE id = 'five-procedures';
UPDATE public.achievements SET points = 2  WHERE id = 'first-kpi';
UPDATE public.achievements SET points = 10 WHERE id = 'ten-kpis';
UPDATE public.achievements SET points = 3  WHERE id = 'first-value-analysis';
UPDATE public.achievements SET points = 3  WHERE id = 'first-audit';
UPDATE public.achievements SET points = 2  WHERE id = 'first-report';
UPDATE public.achievements SET points = 2  WHERE id = 'heat-map-user';
UPDATE public.achievements SET points = 10 WHERE id = 'ai-power-user';
UPDATE public.achievements SET points = 6  WHERE id = 'streak-7';
UPDATE public.achievements SET points = 20 WHERE id = 'streak-30';
UPDATE public.achievements SET points = 15 WHERE id = 'full-process';
UPDATE public.achievements SET points = 30 WHERE id = 'lean-master';

-- Eliminar logros de comunidad (no funcionales aún)
DELETE FROM public.user_achievements WHERE achievement_id IN ('first-share', 'five-shares');
DELETE FROM public.achievements WHERE id IN ('first-share', 'five-shares');

-- Recalcular total_points de usuarios existentes con los nuevos valores
UPDATE public.profiles p
SET total_points = (
  SELECT COALESCE(SUM(a.points), 0)
  FROM public.user_achievements ua
  JOIN public.achievements a ON a.id = ua.achievement_id
  WHERE ua.user_id = p.id
);
