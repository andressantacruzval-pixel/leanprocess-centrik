-- `plan_usage()` — el uso del plan del usuario que llama, para pintarlo en el Hub.
--
-- ⚠️ DEPENDE de la migracion de Lite `20260731000000_plan_level.sql` (columna
-- `profiles.plan_level` y funciones `plan_cap()` / `plan_tokens()`) y de la de App
-- `20260731000009_plan_cap_enforcement.sql`, cuyos helpers reutiliza. No reimplementa
-- ningun contador: compone `lowest_level_process_count()` y `documented_process_count()`.
--
-- POR QUE EXISTE:
-- El Hub vive en LeanProcess Lite, y el CLAUDE.md de Lite le prohibe hacer SELECT sobre
-- las tablas de App (`processes`, `companies`). Esta funcion es la via sancionada: Lite
-- pregunta por su uso sin tocar tablas ajenas.
--
-- ⚠️ SIN PARAMETROS, A PROPOSITO. Usa `auth.uid()`: una funcion que no recibe a quien
-- consultar NO PUEDE consultar a otro. Es exactamente el fallo de `consume_credits`,
-- que acepta `p_user_id`, no valida quien llama, y obligo a revocarle `anon` el 28-jul.
-- Aqui ese error no puede cometerse.
--
-- `cupo` y `tokens_max` van NULL cuando el plan no tiene tope (cuentas que no son
-- `community`): la interfaz lo pinta como "sin limite" en vez de inventarse un numero.

create or replace function public.plan_usage()
returns table (
  nivel        integer,
  cupo         integer,
  procesos     integer,
  documentados integer,
  tokens       integer,
  tokens_max   integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    coalesce(pr.plan_level, 0)::integer                                as nivel,
    public.plan_cap_for_company(c.id)                                  as cupo,
    coalesce(public.lowest_level_process_count(c.id), 0)               as procesos,
    coalesce(public.documented_process_count(c.id), 0)                 as documentados,
    coalesce(pr.credits, 0)::integer                                   as tokens,
    case when pr.plan_type = 'community'
         then public.plan_tokens(pr.plan_level) end                    as tokens_max
  from profiles pr
  -- ponytail: una empresa por usuario. Verificado 2026-07-31: 77 usuarios, 77
  -- empresas, 1:1. Si algun dia alguien tiene dos, se muestra la de mas uso;
  -- agregar varias es trabajo sin caso real. El `order by` deja eso ya resuelto.
  left join lateral (
    select c2.id
    from companies c2
    where c2.user_id = pr.id and c2.onboarding_completed
    order by public.lowest_level_process_count(c2.id) desc, c2.created_at
    limit 1
  ) c on true
  where pr.id = auth.uid();
$$;

comment on function public.plan_usage() is
  'Uso del plan del usuario que llama (auth.uid()): nivel, cupo, procesos, documentados y tokens. Es la via por la que Lite consulta datos de App sin leer sus tablas. Sin parametros a proposito: no puede consultarse a otro usuario.';

revoke all on function public.plan_usage() from public, anon;
grant execute on function public.plan_usage() to authenticated;
