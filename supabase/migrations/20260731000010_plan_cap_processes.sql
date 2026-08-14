-- El tope de CREAR procesos. Esta es la mitad que se aplica ahora.
--
-- La otra mitad (cuota de DOCUMENTACION) vive aparte en
-- `20260731000012_plan_cap_documentation.sql` y NO se aplica todavia: hoy solo
-- afectaria a empresas heredadas que ya exceden su cupo (Marsacot: 149 procesos,
-- 52 documentados, cupo 20), y bloquearles la documentacion de lo que ya crearon
-- es un golpe distinto que merece su propia decision.
--
-- Un plan es UN numero N (= plan_cap(plan_level): 20/30/40/50). Aqui se gobierna
-- solo lo primero: cuantos procesos del NIVEL MAS BAJO se pueden crear.
--
-- GRANDFATHERING: el tope solo mira INSERT. Quien ya excede su cupo conserva todo
-- lo suyo; simplemente no puede anadir uno mas. Marsacot mantiene sus 149.
--
-- Los agrupadores y los macroprocesos NO consumen cupo: son estructura. Verificado
-- en la prueba de esfuerzo del 2026-07-31 (Terrafresca: 8 -> bloqueo exacto en 30;
-- agrupador y macroproceso siguieron permitidos estando en el tope).

create or replace function public.enforce_plan_cap_processes()
returns trigger
language plpgsql
as $$
declare
  v_lowest int;
  v_depth  int := case when new.parent_process_id is null then 1 else 2 end;
  v_cap    int;
  v_count  int;
  v_level  int;
begin
  select case when coalesce(c.process_level_count, 3) <= 2 then 1 else 2 end
    into v_lowest
  from companies c where c.id = new.company_id;

  -- Solo cuentan los del nivel mas bajo: los agrupadores son estructura, no cupo.
  if v_lowest is null or v_depth <> v_lowest then
    return new;
  end if;

  v_cap := public.plan_cap_for_company(new.company_id);
  if v_cap is null then
    return new;
  end if;

  v_count := public.lowest_level_process_count(new.company_id);
  if v_count < v_cap then
    return new;
  end if;

  -- El mensaje LO LEE EL CLIENTE tal cual: `dbWrite` (src/lib/dbWrite.ts) deja
  -- pasar los `check_violation` en vez de taparlos con el generico. Escribirlo
  -- para una persona no es adorno; es el unico texto que va a ver.
  select coalesce(pr.plan_level, 0) into v_level
  from companies c join profiles pr on pr.id = c.user_id
  where c.id = new.company_id;

  if coalesce(v_level, 0) = 0 then
    raise exception
      'Has llegado al límite de tu plan Community: % procesos. Muy pronto habilitaremos nuevos planes para que puedas seguir ampliando tu mapa de procesos en LeanProcess.',
      v_cap
      using errcode = 'check_violation';
  else
    raise exception
      'Has llegado al límite de tu plan: % procesos. Muy pronto habilitaremos más capacidad para que puedas seguir creciendo.',
      v_cap
      using errcode = 'check_violation';
  end if;
end;
$$;

comment on function public.enforce_plan_cap_processes() is
  'Impide crear mas procesos del nivel mas bajo de los que permite el plan. Solo INSERT: quien ya excede su cupo conserva lo suyo.';

drop trigger if exists trg_plan_cap_processes on public.processes;
create trigger trg_plan_cap_processes
  before insert on public.processes
  for each row execute function public.enforce_plan_cap_processes();
