-- El mensaje del tope dice el NOMBRE del plan, no "Community" para todo el mundo.
--
-- El fallo (2026-07-31, visto en produccion): el texto distinguia por `plan_level`
-- pero solo tenia dos variantes, "Community" y una generica. Quien compraba un
-- escalon leia "tu plan: 30 procesos", sin nombre. Y el muro de la pantalla, que es
-- lo que el cliente ve primero, era peor: llamaba "Community" al que acababa de
-- pagar porque miraba `plan_type` (la MEMBRESIA) en vez del nivel.
--
-- Ahora ambos leen el mismo nombre. `plan_name()` es de Lite (mig.
-- `20260731190000_plan_name.sql`), donde vive `profiles.plan_level`.

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

  select coalesce(pr.plan_level, 0) into v_level
  from companies c join profiles pr on pr.id = c.user_id
  where c.id = new.company_id;

  -- El mensaje LO LEE EL CLIENTE tal cual: `dbWrite` (src/lib/dbWrite.ts) deja
  -- pasar los `check_violation` en vez de taparlos con el generico.
  --
  -- Quien esta en el ultimo escalon no tiene a donde subir: prometerle "proximamente
  -- habra planes" seria mentirle. Se le ofrece la unica salida real.
  if coalesce(v_level, 0) >= 3 then
    raise exception
      'Has llegado al límite de tu plan %: % procesos. Escríbenos y buscamos una solución a tu medida.',
      public.plan_name(v_level), v_cap
      using errcode = 'check_violation';
  else
    raise exception
      'Has llegado al límite de tu plan %: % procesos. Muy pronto habilitaremos nuevos planes para que puedas seguir ampliando tu mapa de procesos en LeanProcess.',
      public.plan_name(v_level), v_cap
      using errcode = 'check_violation';
  end if;
end;
$$;
