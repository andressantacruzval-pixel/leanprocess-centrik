-- ─────────────────────────────────────────────────────────────────────────
-- Data Journey — medio de transferencia del activo entre procesos
-- Por qué medio viaja el dato (correo, SFTP, SharePoint, carpeta compartida,
-- físico…) y una descripción del medio. Se guarda en la fila del enlace.
-- Pertenece a LeanProcess App.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.asset_operations
  ADD COLUMN IF NOT EXISTS medium        text,
  ADD COLUMN IF NOT EXISTS medium_detail text;
