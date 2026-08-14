-- Persiste total_points en profiles para disponibilidad inmediata sin JOIN.
-- Actualizado por achievementStore.loadFromDB() via fire-and-forget.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_points INT NOT NULL DEFAULT 0;
