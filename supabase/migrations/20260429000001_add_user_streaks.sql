-- Persiste los datos de streak de actividad por usuario.
-- Tipo B (personal): acceso solo al propio usuario.
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak      INTEGER NOT NULL DEFAULT 0,
  longest_streak      INTEGER NOT NULL DEFAULT 0,
  last_activity_date  DATE,
  activity_history    JSONB NOT NULL DEFAULT '{}',
  freezes_available   INTEGER NOT NULL DEFAULT 2,
  freezes_reset_month TEXT,
  freezes_used        JSONB NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_streaks_select" ON public.user_streaks;
DROP POLICY IF EXISTS "user_streaks_insert" ON public.user_streaks;
DROP POLICY IF EXISTS "user_streaks_update" ON public.user_streaks;
DROP POLICY IF EXISTS "user_streaks_delete" ON public.user_streaks;

CREATE POLICY "user_streaks_select" ON public.user_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_streaks_insert" ON public.user_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_streaks_update" ON public.user_streaks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_streaks_delete" ON public.user_streaks
  FOR DELETE USING (auth.uid() = user_id);
