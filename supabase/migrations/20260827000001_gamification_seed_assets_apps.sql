-- ═══════════════════════════════════════════════════════════════════════════
-- Seed: logros de ACTIVOS DE INFORMACIÓN y APLICACIONES/SOFTWARE
-- Idempotente: ON CONFLICT DO UPDATE permite re-ejecutar sin fallar.
-- Los IDs coinciden con los checks de useAchievementTracker.ts.
-- Categorías existentes (documentacion/analisis/maestria) para no tocar el enum.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.achievements
  (id, title, description, icon, category, points, tier, criteria, sort_order)
VALUES
  -- ── Activos de información (documentacion) ──────────────────────────────
  ('first-asset',
   'Guardián de Datos',
   'Mapea tu primer activo de información',
   'Database', 'documentacion', 10, 'bronze',
   '1 activo de información registrado', 30),

  ('ten-assets',
   'Inventario Vivo',
   'Mapea 10 activos de información',
   'Boxes', 'documentacion', 30, 'silver',
   '10 activos de información registrados', 31),

  ('asset-personal-data',
   'Centinela de Privacidad',
   'Identifica un activo con datos personales',
   'ShieldCheck', 'documentacion', 20, 'bronze',
   '1 activo con datos personales', 32),

  ('asset-classified',
   'Clasificador CIA',
   'Clasifica un activo por Confidencialidad, Integridad y Disponibilidad',
   'ShieldPlus', 'maestria', 40, 'gold',
   '1 activo con criticidad C·I·D calculada', 33),

  -- ── Aplicaciones / software (analisis) ──────────────────────────────────
  ('first-application',
   'Cartógrafo Tecnológico',
   'Registra tu primera aplicación en el inventario',
   'MonitorSmartphone', 'analisis', 10, 'bronze',
   '1 aplicación en el inventario', 34),

  ('ten-applications',
   'Arquitecto de Software',
   'Registra 10 aplicaciones en el inventario',
   'Network', 'analisis', 30, 'silver',
   '10 aplicaciones en el inventario', 35),

  ('app-with-api',
   'Integrador',
   'Identifica una aplicación con API (candidata a automatizar)',
   'Zap', 'analisis', 20, 'bronze',
   '1 aplicación con API', 36),

  ('app-mapped',
   'Trazabilidad Total',
   'Vincula una aplicación a una actividad de un proceso',
   'Workflow', 'maestria', 40, 'gold',
   '1 aplicación usada en un proceso', 37)

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
