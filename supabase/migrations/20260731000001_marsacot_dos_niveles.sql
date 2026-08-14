-- Marsacot: corregir la estructura declarada de 3 niveles a 2.
--
-- Contexto: la empresa declaro 3 niveles en el onboarding pero construyo 24
-- macroprocesos + 149 procesos de nivel 2 + 0 subprocesos, y genero 998 registros
-- de documentacion (BPMN, procedimientos, riesgos, KPIs, auditorias, analisis de
-- valor, SIPOC) sobre esos procesos de nivel 2.
--
-- Lo permitio un predicado equivocado en la app ("no tiene hijos" en vez de "esta
-- en el nivel mas bajo declarado"), corregido en src/lib/processLevels.ts. Con el
-- guard nuevo, mantener process_level_count = 3 dejaria esos 998 registros
-- inaccesibles.
--
-- Su estructura REAL es de 2 niveles. Este cambio no toca ni un solo registro de
-- documentacion: solo reetiqueta la estructura, y con ello los 149 procesos pasan
-- a ser el nivel mas bajo, que es donde su documentacion ya esta.
--
-- Efecto secundario asumido: sus 149 procesos pasan a contar para el tope de 20
-- (COMMUNITY_MAX_SUBPROCESSES). Se comunica al cliente antes de aplicar.
--
-- Idempotente y acotada por id (no por nombre) y por la forma real del arbol:
-- si alguien le hubiera creado subprocesos entre medias, no hace nada.

update companies c
set    process_level_count = 2,
       updated_at = now()
where  c.id = '15bcba3c-6471-4cb0-b0c7-dd9aa4b79215'
  and  c.process_level_count = 3
  and  not exists (
         select 1 from processes p
         where p.company_id = c.id and p.parent_process_id is not null
       );
