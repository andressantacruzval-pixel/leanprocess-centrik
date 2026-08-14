-- `vn` y `EMAPAG EP`: su estructura real es de 2 niveles, no de 3.
--
-- Ambas declararon 3 niveles, tienen 0 subprocesos y toda su documentacion cuelga
-- de procesos de nivel 2, que con el guard de nivel documentable queda bloqueada.
-- Mismo caso y mismo remedio que Marsacot (20260731000001): no se toca ningun
-- registro de documentacion, solo se reetiqueta la estructura para que coincida
-- con lo que realmente construyeron. Desbloquea 5 registros (4 + 1).
-- Ninguna se acerca al tope de 20 (6 y 4 procesos).
--
-- Acotada por id y por la forma del arbol: si tuvieran subprocesos, no hace nada.

update companies c
set    process_level_count = 2,
       updated_at = now()
where  c.id in (
         select c2.id from companies c2 where c2.name in ('vn', 'EMAPAG EP')
       )
  and  c.process_level_count = 3
  and  not exists (
         select 1 from processes p
         where p.company_id = c.id and p.parent_process_id is not null
       );
