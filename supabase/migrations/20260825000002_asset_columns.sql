-- ─────────────────────────────────────────────────────────────────────────
-- Activos de Información — columnas/campos del activo
-- Estructura del activo (p. ej. una base de datos con nombre, cédula,
-- teléfono). Cada columna lleva {name, description}. Permite documentar qué
-- contiene el activo y, más adelante, con qué campos viaja a otros procesos.
-- Pertenece a LeanProcess App.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.information_assets
  ADD COLUMN IF NOT EXISTS columns jsonb NOT NULL DEFAULT '[]'::jsonb;
