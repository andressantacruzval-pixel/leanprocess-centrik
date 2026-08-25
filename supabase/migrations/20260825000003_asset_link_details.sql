-- ─────────────────────────────────────────────────────────────────────────
-- Data Journey — detalle de la transferencia de un activo entre subprocesos
-- Al conectar un activo con otro subproceso se declara QUÉ columnas/campos se
-- envían (minimización de datos) y una justificación. Se guarda en la fila de
-- asset_operations que representa el enlace (origen/destino).
-- Pertenece a LeanProcess App.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.asset_operations
  ADD COLUMN IF NOT EXISTS columns       jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS justification text;
