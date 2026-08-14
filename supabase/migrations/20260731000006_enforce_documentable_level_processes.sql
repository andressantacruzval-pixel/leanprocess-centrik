-- Cierra el ultimo hueco: la caracterizacion y el BPMN legacy no viven en tablas
-- aparte, son COLUMNAS de `processes`, que hasta ahora solo tenia trg_set_updated_at.
-- Son 91 diagramas en `bpmn_xml` mas toda la ficha (responsable, frecuencia,
-- criticidad, las 7 banderas...).
--
-- Fail-closed: se define la lista blanca de columnas ESTRUCTURALES que un proceso
-- agrupador si puede cambiar; todo lo demas se considera documentacion y se bloquea.
-- Cualquier columna que se anada en el futuro nace protegida, no abierta.
--
-- `parent_process_id` va en la lista blanca a proposito: sin ella se romperia el
-- descenso de procesos (mig. 20260731000004, caso SANDRA S.A). Verificado.
--
-- Solo bloquea cambios REALES (`is distinct from`): reescribir el mismo valor pasa.
--
-- Probado (todo dentro de bloques abortados, 0 filas escritas):
--   agrupador + bpmn_xml ......... BLOQUEADO
--   agrupador + caracterizacion .. BLOQUEADO
--   agrupador + renombrar ........ permitido
--   agrupador + orden/org_unit ... permitido
--   hoja + documentacion ......... permitido
--   descenso y reversion ......... permitidos

create or replace function public.enforce_documentable_level_processes()
returns trigger
language plpgsql
as $$
declare
  v_depth  int;
  v_lowest int;
  -- Estructura: que es el proceso y donde vive. Un agrupador puede cambiarlas.
  k_estructurales text[] := array[
    'id','company_id','macroprocess_id','parent_process_id','level_definition_id',
    'name','code','sort_order','org_unit_id','created_at','updated_at'
  ];
begin
  select case when new.parent_process_id is null then 1 else 2 end,
         case when coalesce(c.process_level_count, 3) <= 2 then 1 else 2 end
    into v_depth, v_lowest
  from companies c
  where c.id = new.company_id;

  if v_depth is null or v_depth = v_lowest then
    return new;  -- es del nivel mas bajo: puede documentarse con libertad
  end if;

  -- Es un agrupador: solo se le permiten cambios estructurales.
  if (to_jsonb(new) - k_estructurales) is distinct from (to_jsonb(old) - k_estructurales) then
    raise exception
      'Un proceso agrupador no se documenta. La caracterizacion y el diagrama van en el nivel mas bajo que declaro la empresa (nivel %); este proceso esta en el nivel %.',
      v_lowest + 1, v_depth + 1
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_documentable_level_processes() is
  'Impide caracterizar o diagramar (columnas de `processes`, incluida bpmn_xml) un proceso que no esta en el nivel mas bajo declarado. Permite los cambios estructurales: nombre, codigo, orden, unidad organizativa y posicion en el arbol. Complementa a enforce_documentable_level(), que cubre las 7 tablas de documentacion.';

drop trigger if exists trg_documentable_level_processes on public.processes;
create trigger trg_documentable_level_processes
  before update on public.processes
  for each row execute function public.enforce_documentable_level_processes();
