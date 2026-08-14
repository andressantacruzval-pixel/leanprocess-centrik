-- Hace ESTRUCTURALMENTE imposible documentar en un nivel que no es el mas bajo.
--
-- Hasta ahora la regla solo vivia en React (`isDocumentable` + `useDocumentableGuard`).
-- Las politicas RLS de estas 7 tablas comprueban pertenencia a la empresa, no el
-- nivel, asi que cualquier miembro podia escribir en cualquier proceso suyo desde
-- la consola del navegador, desde una ruta nueva que olvidara el guard, o tras una
-- regresion. Ese fue exactamente el fallo que costo 1.031 registros mal ubicados:
-- el predicado estaba en cuatro sitios y basto que fallara en uno.
--
-- No bloquea reparentar procesos (mover un proceso a otro nivel), que es la
-- operacion de remediacion usada con SANDRA S.A: el trigger vive en las tablas de
-- documentacion, no en `processes`.
--
-- Verificado antes de aplicar: de las 1.710 filas existentes, 0 serian rechazadas.
-- Verificado despues: inserta en una hoja OK, en un agrupador lanza check_violation.

create or replace function public.enforce_documentable_level()
returns trigger
language plpgsql
as $$
declare
  v_depth  int;
  v_lowest int;
begin
  -- Sin proceso asociado no hay nivel que validar (p.ej. un indicador suelto).
  if new.process_id is null then
    return new;
  end if;

  select case when p.parent_process_id is null then 1 else 2 end,
         case when coalesce(c.process_level_count, 3) <= 2 then 1 else 2 end
    into v_depth, v_lowest
  from processes p
  join companies c on c.id = p.company_id
  where p.id = new.process_id;

  -- Proceso inexistente: que lo resuelva la FK, no este trigger.
  if v_depth is null then
    return new;
  end if;

  if v_depth <> v_lowest then
    raise exception
      'La documentacion solo se crea en el nivel mas bajo que declaro la empresa (nivel %). Este proceso esta en el nivel %.',
      v_lowest + 1, v_depth + 1
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_documentable_level() is
  'Impide crear documentacion (BPMN, procedimiento, riesgos, KPIs, auditoria, valor, SIPOC) en un proceso que no esta en el nivel mas bajo declarado en companies.process_level_count. Ver src/lib/processLevels.ts en LeanProcess App.';

drop trigger if exists trg_documentable_level on public.bpmn_diagrams;
create trigger trg_documentable_level before insert or update of process_id
  on public.bpmn_diagrams for each row execute function public.enforce_documentable_level();

drop trigger if exists trg_documentable_level on public.procedures;
create trigger trg_documentable_level before insert or update of process_id
  on public.procedures for each row execute function public.enforce_documentable_level();

drop trigger if exists trg_documentable_level on public.risks;
create trigger trg_documentable_level before insert or update of process_id
  on public.risks for each row execute function public.enforce_documentable_level();

drop trigger if exists trg_documentable_level on public.indicators;
create trigger trg_documentable_level before insert or update of process_id
  on public.indicators for each row execute function public.enforce_documentable_level();

drop trigger if exists trg_documentable_level on public.audits;
create trigger trg_documentable_level before insert or update of process_id
  on public.audits for each row execute function public.enforce_documentable_level();

drop trigger if exists trg_documentable_level on public.value_activities;
create trigger trg_documentable_level before insert or update of process_id
  on public.value_activities for each row execute function public.enforce_documentable_level();

drop trigger if exists trg_documentable_level on public.sipoc_entries;
create trigger trg_documentable_level before insert or update of process_id
  on public.sipoc_entries for each row execute function public.enforce_documentable_level();
