-- Contadores del plan. TODO ES DE SOLO LECTURA: nada de esto bloquea a nadie.
--
-- Se separo de la migracion que aplica el tope (`20260731000010`) justo por eso:
-- estas funciones se pueden aplicar sin riesgo para que el Hub muestre el uso,
-- mientras el bloqueo espera al despliegue final.
--
-- ⚠️ DEPENDE de la migracion de Lite `20260731000000_plan_level.sql`, que crea
-- `profiles.plan_level` y `plan_cap()`. Aqui no se redefine ninguna: se consumen.

-- Cupo del dueño de la empresa. NULL = sin tope (su plan no es `community`).
--
-- ALCANCE: hoy el tope solo aplica a `community`, que es como se comporta el
-- cliente desde siempre. Las cuentas `free`/`pro` (2 de staff y legados sin
-- procesos) siguen sin tope; extenderlo es otra conversacion y se hace quitando
-- la condicion de `plan_type` de aqui.
create or replace function public.plan_cap_for_company(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when pr.plan_type = 'community' then public.plan_cap(pr.plan_level) end
  from companies c
  join profiles pr on pr.id = c.user_id
  where c.id = p_company_id;
$$;

comment on function public.plan_cap_for_company(uuid) is
  'Cupo de procesos del dueño de la empresa (20/30/40/50), o NULL si su plan no tiene tope. Usa plan_cap(), de la migracion de Lite 20260731000000_plan_level.sql.';

-- ¿Este proceso ya tiene documentacion de cualquier tipo?
-- La unidad del cupo es el PROCESO, no el artefacto: documentarlo lo desbloquea
-- entero, asi que uno con los siete artefactos cuenta igual que uno con un KPI.
create or replace function public.is_process_documented(p_process_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from bpmn_diagrams    where process_id = p_process_id)
      or exists (select 1 from procedures       where process_id = p_process_id)
      or exists (select 1 from risks            where process_id = p_process_id)
      or exists (select 1 from indicators       where process_id = p_process_id)
      or exists (select 1 from audits           where process_id = p_process_id)
      or exists (select 1 from value_activities where process_id = p_process_id)
      or exists (select 1 from sipoc_entries    where process_id = p_process_id)
      or exists (select 1 from processes
                 where id = p_process_id and bpmn_xml is not null and length(bpmn_xml) > 100);
$$;

comment on function public.is_process_documented(uuid) is
  'Si un proceso tiene documentacion de cualquier tipo. La unidad del tope es el proceso, no el artefacto.';

-- ponytail: O(n) sobre los procesos de la empresa, con n <= 50 por el propio tope
-- (Marsacot, el mayor, tiene 149). Si algun dia duele, materializar un booleano
-- `is_documented` en `processes` mantenido por los mismos triggers.
create or replace function public.documented_process_count(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer from processes p
  where p.company_id = p_company_id and public.is_process_documented(p.id);
$$;

-- Cuantos procesos tiene la empresa en su nivel mas bajo declarado. Los
-- agrupadores son estructura, no cupo. Lo usan el trigger y `plan_usage()`:
-- una sola definicion de "cuantos procesos tengo".
create or replace function public.lowest_level_process_count(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer
  from processes p
  join companies c on c.id = p.company_id
  where p.company_id = p_company_id
    and (case when p.parent_process_id is null then 1 else 2 end)
      = (case when coalesce(c.process_level_count, 3) <= 2 then 1 else 2 end);
$$;

comment on function public.lowest_level_process_count(uuid) is
  'Procesos de la empresa en su nivel mas bajo declarado: los que cuentan para el cupo del plan.';
