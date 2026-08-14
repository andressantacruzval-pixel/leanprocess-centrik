-- Publicacion del proceso: «Aprobar y publicar» (sync del 2026-08-11).
--
-- Publicado = published_at is not null. Un booleano habria bastado, pero la fecha
-- sale al mismo precio y es lo que va en la cabecera del documento controlado.
--
-- Por que esto NO choca con los guardas que ya existen sobre `processes`
-- (verificado leyendo las funciones en produccion el 2026-08-11):
--
--   · enforce_documentable_level_processes(): en un proceso del nivel mas bajo hace
--     `return new` ANTES de comparar contra la lista blanca k_estructurales, asi que
--     no bloquea columnas nuevas. En un agrupador SI bloquea — y es lo correcto:
--     un agrupador no se documenta ni se publica.
--
--   · is_process_documented(): mira las 7 tablas de documentacion y `bpmn_xml`.
--     No mira `version` ni `published_at`, de modo que publicar NO consume cupo de plan.
--
--   · trg_plan_cap_processes dispara solo en INSERT; esto son UPDATE.

alter table processes
  add column if not exists published_at timestamptz;

comment on column processes.published_at is
  'Fecha de la ultima publicacion («Aprobar y publicar»). NULL = borrador, editable. '
  'Solo al publicar sube processes.version; guardar no la toca.';
