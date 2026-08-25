-- ─────────────────────────────────────────────────────────────────────────
-- Data Journey — tratamiento del activo en el proceso DESTINO
-- Al transferir un activo, el proceso que lo recibe declara qué hace con él
-- (almacena, transforma, usa, elimina…). Se guarda en la fila del enlace.
-- Pertenece a LeanProcess App.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.asset_operations
  ADD COLUMN IF NOT EXISTS dest_operation text;
