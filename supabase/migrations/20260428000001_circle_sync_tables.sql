-- ═══════════════════════════════════════════════════════════════════════════
-- Circle.so Sync — DB Support
-- Propósito: habilitar el batch semanal de puntos LeanProcess → Circle.so
--
-- Cambios:
--   1. profiles: +circle_member_id, +circle_last_synced_pts
--   2. circle_sync_runs: tabla de auditoría de cada ejecución semanal
--   3. gamification_sync: vista actualizada con delta_points para N8N
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas en profiles ───────────────────────────────────────────────
-- circle_member_id: ID numérico del miembro en Circle obtenido via API por email.
--   NULL = aún no resuelto (usuario marcó circle_member=true pero N8N no hizo
--   el lookup todavía). N8N no intentará sincronizar a este usuario hasta que
--   este campo esté poblado.
--
-- circle_last_synced_pts: total de puntos que ya fueron enviados exitosamente
--   a Circle en el último batch. Empieza en 0. N8N actualiza este campo al
--   finalizar cada sync exitoso. La diferencia (total_points - este valor)
--   es exactamente cuántos posts debe crear en Circle.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS circle_member_id       TEXT NULL,
  ADD COLUMN IF NOT EXISTS circle_last_synced_pts INT  NOT NULL DEFAULT 0;

-- ── 2. Tabla de auditoría circle_sync_runs ────────────────────────────────
-- Registra cada ejecución del batch semanal. Permite detectar fallos,
-- auditar el consumo de API calls y debuggear problemas de sincronización.

CREATE TABLE IF NOT EXISTS public.circle_sync_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  users_processed  INT         NOT NULL DEFAULT 0,
  posts_created    INT         NOT NULL DEFAULT 0,
  api_calls_used   INT         NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running','completed','partial','failed')),
  error_details    JSONB       NULL,
  completed_at     TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_run_at
  ON public.circle_sync_runs(run_at DESC);

ALTER TABLE public.circle_sync_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.circle_sync_runs FROM anon, authenticated;
GRANT ALL  ON public.circle_sync_runs TO service_role;

-- ── 3. Vista gamification_sync — actualizada ─────────────────────────────
-- Agrega circle_member_id, circle_last_synced_pts, y la columna calculada
-- delta_points = max(total_points - circle_last_synced_pts, 0).
--
-- N8N filtra: WHERE delta_points > 0 AND circle_member_id IS NOT NULL
-- Esto garantiza que:
--   a) Solo se procesan usuarios con puntos nuevos esta semana.
--   b) Solo se procesan usuarios cuyo circle_member_id ya fue resuelto.
--   c) Usuarios inactivos consumen 0 API calls.

-- DROP previo: la vista ya existe de una migración anterior con otras columnas,
-- y CREATE OR REPLACE no puede renombrar columnas de una vista (SQLSTATE 42P16).
-- Recrearla desde cero es seguro en cualquier orden de replay.
DROP VIEW IF EXISTS public.gamification_sync;

CREATE OR REPLACE VIEW public.gamification_sync AS
SELECT
  u.email,
  p.id                                                    AS user_id,
  p.full_name,
  p.circle_member,
  p.circle_member_id,
  p.circle_last_synced_pts,
  COUNT(ua.id)::INT                                       AS achievements_count,
  COALESCE(SUM(a.points), 0)::INT                        AS total_points,
  GREATEST(
    COALESCE(SUM(a.points), 0)::INT - p.circle_last_synced_pts,
    0
  )                                                       AS delta_points,
  CEIL(
    GREATEST(
      COALESCE(SUM(a.points), 0)::INT - p.circle_last_synced_pts,
      0
    )::NUMERIC / 10
  )::INT                                                  AS posts_to_create,
  MAX(ua.unlocked_at)                                     AS last_achievement_at
FROM auth.users u
JOIN public.profiles p                ON p.id = u.id
LEFT JOIN public.user_achievements ua ON ua.user_id = u.id
LEFT JOIN public.achievements a       ON a.id = ua.achievement_id
                                      AND a.is_active = true
WHERE p.circle_member = true
GROUP BY
  u.email, p.id, p.full_name, p.circle_member,
  p.circle_member_id, p.circle_last_synced_pts;

REVOKE ALL ON public.gamification_sync FROM anon, authenticated;
GRANT SELECT ON public.gamification_sync TO service_role;
