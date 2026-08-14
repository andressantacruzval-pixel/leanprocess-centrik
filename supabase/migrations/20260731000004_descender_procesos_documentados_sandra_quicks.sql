-- SANDRA S.A y QuickS: bajar a nivel 3 los procesos que tienen documentacion.
--
-- Las dos declararon 3 niveles y documentaron en el nivel 2, que con el guard de
-- nivel documentable queda bloqueado. A diferencia de Marsacot NO se les puede
-- pasar a 2 niveles: ya tienen subprocesos, que quedarian por debajo del nivel mas
-- bajo y dejarian de mostrarse en el mapa (en una empresa de 2 niveles el drilldown
-- pinta los procesos como tarjetas finales y nunca baja). SANDRA ademas perderia
-- los 8 registros que si tiene bien puestos en `venta y compra de divisas`.
--
-- Remedio: a cada proceso documentado se le crea un agrupador padre CON SU MISMO
-- NOMBRE y el proceso pasa a ser su subproceso. La documentacion no se mueve:
-- sigue apuntando al mismo process_id, solo cambia parent_process_id.
-- Desbloquea 28 registros (16 + 10 + 2).
--
-- Idempotente: si el proceso ya tiene padre, `origen` sale vacio y no hace nada.
-- Reversible: borrar el agrupador y poner parent_process_id = null.
--
-- Resultado verificado: 0 registros bloqueados en todo el sistema (eran 1.031 el
-- 31-jul antes de esta serie), 1.710 bien ubicados, y ninguna empresa perdio nada.

-- SANDRA S.A — Gestion de proveedores (16 registros)
with origen as (
  select id, company_id, macroprocess_id, name, sort_order
  from processes where id = 'fb880db2-bfa7-4414-916f-66245d4e90e5' and parent_process_id is null
), padre as (
  insert into processes (company_id, macroprocess_id, name, sort_order)
  select company_id, macroprocess_id, name, sort_order from origen
  returning id
)
update processes p set parent_process_id = (select id from padre)
where p.id = (select id from origen);

-- SANDRA S.A — pagos a proveedores (10 registros)
with origen as (
  select id, company_id, macroprocess_id, name, sort_order
  from processes where id = 'ce23f56f-40f6-480c-a141-d6f398d555fa' and parent_process_id is null
), padre as (
  insert into processes (company_id, macroprocess_id, name, sort_order)
  select company_id, macroprocess_id, name, sort_order from origen
  returning id
)
update processes p set parent_process_id = (select id from padre)
where p.id = (select id from origen);

-- QuickS — "1" (2 registros)
with origen as (
  select id, company_id, macroprocess_id, name, sort_order
  from processes where id = '93437c61-424d-41ef-a2e6-2df586a7a526' and parent_process_id is null
), padre as (
  insert into processes (company_id, macroprocess_id, name, sort_order)
  select company_id, macroprocess_id, name, sort_order from origen
  returning id
)
update processes p set parent_process_id = (select id from padre)
where p.id = (select id from origen);
