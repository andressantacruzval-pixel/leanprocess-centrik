-- Paso 4 del plan — quitar scoping por user_id en sipoc_* y catalog_items.
-- Todas las tablas están vacías; dropeamos la columna user_id y la policy legacy.

DROP POLICY IF EXISTS sipoc_suppliers_crud_own ON sipoc_suppliers;
DROP POLICY IF EXISTS sipoc_customers_crud_own ON sipoc_customers;
DROP POLICY IF EXISTS catalog_items_crud_own   ON catalog_items;

-- Policies legacy creadas en 001_initial_schema.sql. Dependen de user_id, así
-- que hay que soltarlas antes del DROP COLUMN o el replay desde cero falla
-- (SQLSTATE 2BP01). En producción ya no existen; el IF EXISTS lo hace inocuo.
DROP POLICY IF EXISTS "Users manage own suppliers" ON sipoc_suppliers;
DROP POLICY IF EXISTS "Users manage own customers" ON sipoc_customers;
DROP POLICY IF EXISTS "Users manage own catalogs"  ON catalog_items;

ALTER TABLE sipoc_suppliers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sipoc_customers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE catalog_items   ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE sipoc_suppliers DROP COLUMN user_id;
ALTER TABLE sipoc_customers DROP COLUMN user_id;
ALTER TABLE catalog_items   DROP COLUMN user_id;
