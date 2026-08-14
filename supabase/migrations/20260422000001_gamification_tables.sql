-- ═══════════════════════════════════════════════════════════════════════════
-- Gamification: tablas achievements + user_achievements + RLS + vista n8n
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Catálogo de logros ─────────────────────────────────────────────────
-- IDs tipo texto semántico ('first-process') para coincidir con las constantes
-- del código sin necesidad de mapeo adicional.
CREATE TABLE IF NOT EXISTS public.achievements (
  id          TEXT        PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  icon        TEXT        NOT NULL,      -- Nombre de ícono Lucide
  category    TEXT        NOT NULL
    CHECK (category IN ('procesos','riesgos','documentacion','analisis','maestria','comunidad')),
  points      INT         NOT NULL CHECK (points > 0),
  tier        TEXT        NOT NULL
    CHECK (tier IN ('bronze','silver','gold','platinum')),
  criteria    TEXT        NOT NULL DEFAULT '',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Estado de logros por usuario ──────────────────────────────────────
-- UNIQUE (user_id, achievement_id) garantiza que cada logro se desbloquea
-- una sola vez por usuario. El código maneja el error 23505 como no-error.
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id       TEXT        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shared_to_community  BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_id)
);

-- ── 3. Índices ────────────────────────────────────────────────────────────
-- Query principal del store: cargar todos los logros de un usuario
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
  ON public.user_achievements(user_id);

-- Leaderboard y n8n: ordenar por fecha de desbloqueo
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked
  ON public.user_achievements(user_id, unlocked_at DESC);

-- Filtro por categoría en la UI (solo activos)
CREATE INDEX IF NOT EXISTS idx_achievements_category
  ON public.achievements(category) WHERE is_active = true;

-- ── 4. Trigger updated_at ─────────────────────────────────────────────────
-- Reutiliza la función set_updated_at() que ya existe en el proyecto
DROP TRIGGER IF EXISTS trg_achievements_updated_at ON public.achievements;
CREATE TRIGGER trg_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. Row Level Security ─────────────────────────────────────────────────
ALTER TABLE public.achievements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Catálogo: todos los usuarios autenticados pueden leer.
-- Escritura solo vía service_role (migraciones/seed).
DROP POLICY IF EXISTS "achievements_select_all" ON public.achievements;
CREATE POLICY "achievements_select_all"
  ON public.achievements FOR SELECT
  USING (true);

-- user_achievements: cada usuario SOLO ve y modifica los SUYOS.
-- No hay política DELETE — los logros son permanentes.
-- Si el usuario elimina su cuenta, el CASCADE de auth.users los borra.
DROP POLICY IF EXISTS "user_achievements_select_own" ON public.user_achievements;
CREATE POLICY "user_achievements_select_own"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_achievements_insert_own" ON public.user_achievements;
CREATE POLICY "user_achievements_insert_own"
  ON public.user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_achievements_update_own" ON public.user_achievements;
CREATE POLICY "user_achievements_update_own"
  ON public.user_achievements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 6. Vista gamification_sync para n8n ──────────────────────────────────
-- Solo accesible con service_role key (n8n usa esa clave).
-- Retorna email + puntos totales solo de usuarios que son miembros de Circle.
CREATE OR REPLACE VIEW public.gamification_sync AS
SELECT
  u.email,
  p.id          AS user_id,
  p.full_name,
  p.circle_member,
  COUNT(ua.id)::INT                   AS achievements_count,
  COALESCE(SUM(a.points), 0)::INT     AS total_points,
  MAX(ua.unlocked_at)                 AS last_achievement_at
FROM auth.users u
JOIN public.profiles p               ON p.id = u.id
LEFT JOIN public.user_achievements ua ON ua.user_id = u.id
LEFT JOIN public.achievements a       ON a.id = ua.achievement_id
                                      AND a.is_active = true
WHERE p.circle_member = true
GROUP BY u.email, p.id, p.full_name, p.circle_member;

-- Solo service_role puede consultar la vista
REVOKE ALL ON public.gamification_sync FROM anon, authenticated;
GRANT SELECT ON public.gamification_sync TO service_role;
