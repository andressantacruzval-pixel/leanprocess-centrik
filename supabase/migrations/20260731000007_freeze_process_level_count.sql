-- La estructura de niveles se elige UNA vez y no se cambia.
--
-- `companies.process_level_count` decide en que nivel se documenta. Cambiarla
-- despues deja toda la documentacion existente en el nivel equivocado de golpe
-- y en silencio: es justo lo que le paso a Marsacot al reves.
--
-- No se puede hacer con RLS: una politica no ve el valor anterior de la columna,
-- solo la fila resultante. Hace falta un trigger que compare OLD con NEW.
--
-- Regla: se puede fijar mientras el onboarding NO este completo (es el momento de
-- elegir, y tambien tras un `reset_company`, que borra la empresa entera y vuelve
-- a poner onboarding_completed = false). Una vez completo, congelada.
--
-- El bloqueo aplica a los roles de la aplicacion (`authenticated`, `anon`), es
-- decir a cualquier peticion del navegador, incluida la del owner. Los roles de
-- backend (`postgres`, `service_role`) siguen pudiendo, que es como se corrigieron
-- Marsacot, `vn` y `EMAPAG EP`; sin esa via no habria forma de reparar datos.
--
-- El camino legitimo para cambiar de estructura es reiniciar la empresa desde la
-- interfaz, que borra procesos, macroprocesos y toda la documentacion.
--
-- Probado en produccion simulando el JWT de PostgREST (owner autenticado, pasando
-- RLS), dentro de un bloque abortado:
--   cambiar process_level_count ... BLOQUEADO
--   cambiar el nombre ............ OK (1 fila)
--   empresa sin onboarding ....... OK (se puede elegir)

create or replace function public.freeze_process_level_count()
returns trigger
language plpgsql
as $$
begin
  if new.process_level_count is distinct from old.process_level_count
     and coalesce(old.onboarding_completed, false)
     and current_user in ('authenticated', 'anon')
  then
    raise exception
      'La estructura de niveles se elige una sola vez, al completar el onboarding, y no se puede cambiar despues. Para cambiarla hay que reiniciar la empresa, lo que borra todos sus procesos y documentacion.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.freeze_process_level_count() is
  'Congela companies.process_level_count una vez completado el onboarding. Cambiarla dejaria toda la documentacion existente en el nivel equivocado. Bloquea a authenticated/anon (incluido el owner); los roles de backend pueden, para poder reparar datos. Ver docs/App/niveles-y-documentacion.md.';

drop trigger if exists trg_freeze_process_level_count on public.companies;
create trigger trg_freeze_process_level_count
  before update on public.companies
  for each row execute function public.freeze_process_level_count();
