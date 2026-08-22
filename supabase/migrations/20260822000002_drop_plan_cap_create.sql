-- ─────────────────────────────────────────────────────────────────────────────
-- Corrección del modelo de cupo (2026-08-22)
--
-- Antes el plan limitaba CREAR procesos del nivel más bajo (trg_plan_cap_processes,
-- mig. 20260731000010). Eso frenaba armar el mapa: el usuario no podía siquiera
-- tener la tarjeta del subproceso, y por tanto tampoco entrar a caracterizar,
-- diagramar, riesgos, controles, etc. Además, el inventario generado con IA no se
-- podía volcar completo (la base rechazaba los que excedían el tope).
--
-- Nueva regla: CREAR es LIBRE. El cupo del plan gobierna DOCUMENTAR (caracterizar
-- y sus artefactos). La cuota de documentación se mantiene íntegra
-- (enforce_documentable_level / enforce_documentable_level_processes) y el cliente
-- muestra el control de ampliación cuando se intenta documentar por encima del cupo.
--
-- Se elimina el trigger de tope de creación (y su función, ya sin uso).
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_plan_cap_processes on public.processes;
drop function if exists public.enforce_plan_cap_processes();
