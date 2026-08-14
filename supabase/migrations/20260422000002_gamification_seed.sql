-- ═══════════════════════════════════════════════════════════════════════════
-- Seed: 29 logros del sistema de gamificación
-- Idempotente: ON CONFLICT DO UPDATE permite re-ejecutar sin fallar.
-- Los IDs coinciden exactamente con las constantes del achievementStore.ts.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.achievements
  (id, title, description, icon, category, points, tier, criteria, sort_order)
VALUES
  -- ── PROCESOS ────────────────────────────────────────────────────────────
  ('first-process',
   'Primer Paso',
   'Crea tu primer subproceso',
   'Footprints', 'procesos', 10, 'bronze',
   '1 subproceso creado', 1),

  ('five-processes',
   'Arquitecto Junior',
   'Crea 5 subprocesos',
   'Layers', 'procesos', 25, 'silver',
   '5 subprocesos creados', 2),

  ('ten-processes',
   'Arquitecto Senior',
   'Crea 10 subprocesos',
   'Building2', 'procesos', 50, 'gold',
   '10 subprocesos creados', 3),

  ('twenty-processes',
   'Maestro de Procesos',
   'Crea 20 subprocesos',
   'Crown', 'procesos', 100, 'platinum',
   '20 subprocesos creados', 4),

  ('first-bpmn',
   'Diagramador',
   'Crea tu primer diagrama BPMN',
   'GitBranch', 'procesos', 15, 'bronze',
   '1 diagrama BPMN creado', 5),

  ('five-bpmn',
   'Maestro BPMN',
   'Crea 5 diagramas BPMN',
   'Workflow', 'procesos', 50, 'gold',
   '5 diagramas BPMN creados', 6),

  -- ── RIESGOS ─────────────────────────────────────────────────────────────
  ('first-risk',
   'Vigilante',
   'Identifica tu primer riesgo',
   'ShieldAlert', 'riesgos', 10, 'bronze',
   '1 riesgo identificado', 7),

  ('ten-risks',
   'Guardian',
   'Identifica 10 riesgos',
   'Shield', 'riesgos', 40, 'silver',
   '10 riesgos identificados', 8),

  ('first-control',
   'Controlador',
   'Define tu primer control',
   'ShieldCheck', 'riesgos', 15, 'bronze',
   '1 control definido', 9),

  ('ten-controls',
   'Risk Manager',
   'Define 10 controles',
   'ShieldPlus', 'riesgos', 50, 'gold',
   '10 controles definidos', 10),

  -- ── DOCUMENTACIÓN ───────────────────────────────────────────────────────
  ('first-procedure',
   'Documentador',
   'Genera tu primer procedimiento',
   'BookOpen', 'documentacion', 15, 'bronze',
   '1 procedimiento generado', 11),

  ('five-procedures',
   'Escribano',
   'Genera 5 procedimientos',
   'BookMarked', 'documentacion', 40, 'silver',
   '5 procedimientos generados', 12),

  ('first-kpi',
   'Medidor',
   'Define tu primer KPI',
   'TrendingUp', 'documentacion', 10, 'bronze',
   '1 KPI definido', 13),

  ('ten-kpis',
   'Data Driven',
   'Define 10 KPIs',
   'BarChart3', 'documentacion', 50, 'gold',
   '10 KPIs definidos', 14),

  -- ── ANÁLISIS ────────────────────────────────────────────────────────────
  ('first-value-analysis',
   'Analista',
   'Clasifica actividades VA/NVA',
   'Activity', 'analisis', 15, 'bronze',
   'Primer analisis de valor', 15),

  ('first-audit',
   'Auditor',
   'Genera tu primer programa de auditoria',
   'ClipboardCheck', 'analisis', 15, 'bronze',
   '1 programa de auditoria', 16),

  ('first-report',
   'Reportero',
   'Exporta tu primer reporte',
   'FileText', 'analisis', 10, 'bronze',
   '1 reporte exportado', 17),

  ('heat-map-user',
   'Estratega',
   'Usa el mapa de calor de riesgos',
   'Flame', 'analisis', 10, 'bronze',
   'Visita el mapa de calor', 18),

  -- ── MAESTRÍA ────────────────────────────────────────────────────────────
  ('ai-power-user',
   'IA Power User',
   'Usa 5 funciones de IA diferentes',
   'Sparkles', 'maestria', 50, 'gold',
   '5 features de IA usados', 19),

  ('streak-7',
   'Semana Perfecta',
   '7 dias consecutivos activo',
   'Flame', 'maestria', 30, 'silver',
   'Streak de 7 dias', 20),

  ('streak-30',
   'Mes Invicto',
   '30 dias consecutivos activo',
   'Trophy', 'maestria', 100, 'platinum',
   'Streak de 30 dias', 21),

  ('full-process',
   'Proceso Completo',
   'Un proceso con BPMN + procedimiento + KPI + riesgos',
   'Star', 'maestria', 75, 'gold',
   'Proceso 100% documentado', 22),

  ('lean-master',
   'Lean Process Master',
   'Completa todos los milestones del onboarding',
   'Award', 'maestria', 150, 'platinum',
   '10/10 milestones completados', 23),

  -- ── COMUNIDAD ───────────────────────────────────────────────────────────
  ('first-share',
   'Compartidor',
   'Comparte tu primer resultado en la comunidad',
   'Share2', 'comunidad', 20, 'bronze',
   'Primer post en comunidad', 24),

  ('five-shares',
   'Influencer',
   'Comparte 5 resultados en la comunidad',
   'Users', 'comunidad', 50, 'gold',
   '5 posts en comunidad', 25)

ON CONFLICT (id) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  points      = EXCLUDED.points,
  tier        = EXCLUDED.tier,
  criteria    = EXCLUDED.criteria,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();
