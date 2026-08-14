-- La guarda del downgrade: cuantos procesos SOBRAN para poder bajar a un escalon.
--
-- Decision del 2026-07-30 ([[Bajar de plan exige quedar bajo el limite del plan destino]]):
-- el cambio de plan es autoservicio, pero bajar se BLOQUEA mientras el cliente tenga
-- mas procesos de los que caben abajo. Primero borra, luego baja. El sistema no elige
-- por el que procesos sacrificar.
--
-- Vive en App porque lee `processes` y `companies`. La consume la Edge Function
-- `plan-checkout` del CRM antes de abrir el portal de Stripe: **el bloqueo tiene que
-- estar donde se INICIA el cambio de plan**, no en la pantalla de procesos — un cambio
-- hecho desde el portal de Stripe no pasa por ninguna pantalla nuestra.
--
-- Recibe el perfil como parametro (no usa `auth.uid()`) porque quien la llama es la
-- Edge Function con `service_role`, donde `auth.uid()` es NULL. Por eso NO se concede
-- a `authenticated`: el panel del Hub no la necesita —ya tiene `plan_usage()` y el
-- cupo de cada escalon— y una funcion que acepta "de quien" y se puede llamar desde el
-- navegador es exactamente el patron que hubo que revertir con `consume_credits`.

create or replace function public.plan_downgrade_excess(
  p_profile_id uuid,
  p_target_level integer
)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select greatest(
    0,
    coalesce(public.lowest_level_process_count(c.id), 0) - public.plan_cap(p_target_level)
  )
  from profiles pr
  -- La misma empresa que reporta `plan_usage()`: la de mas uso. Verificado 1:1 en
  -- produccion, pero si algun dia alguien tiene dos, las dos funciones coinciden.
  left join lateral (
    select c2.id from companies c2
    where c2.user_id = pr.id and c2.onboarding_completed
    order by public.lowest_level_process_count(c2.id) desc, c2.created_at
    limit 1
  ) c on true
  where pr.id = p_profile_id;
$fn$;

comment on function public.plan_downgrade_excess(uuid, integer) is
  'Procesos que sobran para poder bajar al escalon dado; 0 = puede bajar. Lo consulta plan-checkout antes de abrir el portal de Stripe.';

revoke all on function public.plan_downgrade_excess(uuid, integer) from public, anon, authenticated;
grant execute on function public.plan_downgrade_excess(uuid, integer) to service_role;
