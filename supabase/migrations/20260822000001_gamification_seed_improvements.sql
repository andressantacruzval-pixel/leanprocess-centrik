-- ═══════════════════════════════════════════════════════════════════════════
-- Seed: logros de MEJORAS (oportunidades identificadas vs implementadas/cerradas)
-- Idempotente: ON CONFLICT DO UPDATE permite re-ejecutar sin fallar.
-- Los IDs coinciden con los checks de useAchievementTracker.ts.
-- Categorías existentes (analisis/maestria) para no tocar el enum de la app.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.achievements
  (id, title, description, icon, category, points, tier, criteria, sort_order)
VALUES
  ('first-improvement',
   'Detector de Mejoras',
   'Identifica tu primera oportunidad de mejora',
   'Lightbulb', 'analisis', 10, 'bronze',
   '1 mejora identificada', 26),

  ('five-improvements',
   'Cazador de Oportunidades',
   'Identifica 5 oportunidades de mejora',
   'Sparkles', 'analisis', 30, 'silver',
   '5 mejoras identificadas', 27),

  ('first-improvement-closed',
   'Ejecutor',
   'Cierra tu primera mejora',
   'Award', 'analisis', 20, 'bronze',
   '1 mejora cerrada', 28),

  ('five-improvements-closed',
   'Agente de Cambio',
   'Cierra 5 mejoras',
   'Rocket', 'maestria', 60, 'gold',
   '5 mejoras cerradas', 29)

ON CONFLICT (id) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  category    = EXCLUDED.category,
  points      = EXCLUDED.points,
  tier        = EXCLUDED.tier,
  criteria    = EXCLUDED.criteria,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();
