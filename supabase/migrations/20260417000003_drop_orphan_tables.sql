-- Paso 5 del plan — eliminar tablas huérfanas (H-4, H-5).
-- process_indicators y process_risks fueron diseños alternativos nunca adoptados:
-- cero lecturas, cero escrituras desde la app. Dropear directamente (ambas vacías).

DROP TABLE IF EXISTS public.process_indicators CASCADE;
DROP TABLE IF EXISTS public.process_risks CASCADE;
