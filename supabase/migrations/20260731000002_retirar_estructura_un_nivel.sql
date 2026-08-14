-- Retirar la estructura de "1 nivel": nunca estuvo implementada.
--
-- El mapa de procesos siempre pinta macroprocesos y `addProcess` siempre exige un
-- `macroprocess_id`, asi que declarar 1 nivel producia exactamente la misma
-- estructura que 2 (macroproceso -> proceso) mientras la tarjeta del onboarding
-- prometia "sin jerarquia de procesos". VARELA STRATEGIC RISC & SECURITY es la
-- prueba: eligio 1 nivel y tiene 13 macroprocesos y 65 procesos.
--
-- La opcion se retira de PROCESS_LEVEL_OPTIONS (src/lib/constants.ts). Esta
-- migracion alinea las 3 empresas que la tenian.
--
-- Es un no-op de comportamiento: `isDocumentable` trata 1 y 2 igual (en ambos el
-- nivel mas bajo es la profundidad 1), asi que ni la documentacion ni el tope de
-- procesos cambian para nadie. Solo deja de haber datos apuntando a una opcion
-- que ya no existe.

update companies
set    process_level_count = 2,
       updated_at = now()
where  process_level_count = 1;
