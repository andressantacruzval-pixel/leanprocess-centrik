-- Codificacion de documentos parametrizable (sync del 2026-08-11).
--
-- Motivo, medido en produccion el 2026-08-11: todo procedimiento nacia con el literal
-- 'LP-PRO-001', asi que **70 de 75 documentos comparten identificador**, y una sola
-- empresa acumula 23 iguales. En una herramienta que se vende para ISO, el codigo del
-- documento no puede ser una constante.
--
-- Dos columnas escalares en vez de un jsonb: son dos valores, no una estructura, y asi
-- no hay forma que validar ni schema Zod que mantener.
--
-- Aditivas y nullable sobre una tabla propiedad de App (el CRM solo la lee) -> cumple
-- CLAUDE.md §6.4. NULL = la empresa aun no eligio; la app cae a 'PRO' + 'tipo-num'.

alter table companies
  add column if not exists doc_code_pattern text,
  add column if not exists doc_code_prefix  text;

comment on column companies.doc_code_pattern is
  'Orden de los segmentos del codigo de documento: tipo-area-num | area-tipo-num | tipo-num. NULL = sin elegir.';
comment on column companies.doc_code_prefix is
  'Prefijo del tipo de documento (ej. PRO). NULL = sin elegir, la app usa PRO.';
