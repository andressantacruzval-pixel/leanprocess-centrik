-- Migración: Campos Stripe a nivel de plan en profiles + tabla stripe_events
-- ────────────────────────────────────────────────────────────────────────
-- Contexto: la app integra Stripe para suscripciones de planes (Community/Pro/Max),
-- addons (empresa extra, miembro extra) y compras únicas (paquetes de tokens).
-- Esta migración alinea el schema para soportar todos los flujos correctamente.
--
-- Cambios:
--  1. profiles: elimina campo mal modelado, agrega campos del plan a nivel usuario
--  2. company_addons: agrega stripe_price_id para trazabilidad del precio cobrado
--  3. token_transactions: agrega stripe_invoice_id para link a factura PDF
--  4. stripe_events: tabla nueva para idempotencia y auditoría de webhooks
-- ────────────────────────────────────────────────────────────────────────

-- 1. profiles: limpiar campo mal modelado y agregar campos del plan ────────

-- El campo stripe_subscription_id asumía 1 sub por usuario, pero un usuario
-- puede tener N suscripciones (plan + addons). Eliminado.
ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_subscription_id;

-- Campos para trazar el plan (Community/Pro/Max) del usuario
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_plan_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- Constraint: plan_status solo valores válidos
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_status_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_plan_status_check
  CHECK (plan_status IN ('free', 'trialing', 'active', 'past_due', 'canceled'));

-- Índices para búsqueda rápida en webhook (Stripe → user)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_plan_sub
  ON profiles(stripe_plan_subscription_id) WHERE stripe_plan_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_plan_status
  ON profiles(plan_status);


-- 2. company_addons: agregar stripe_price_id ─────────────────────────────────

ALTER TABLE company_addons
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

CREATE INDEX IF NOT EXISTS idx_company_addons_provider_ref
  ON company_addons(provider_ref) WHERE provider_ref IS NOT NULL;


-- 3. token_transactions: agregar stripe_invoice_id ───────────────────────────

ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

CREATE INDEX IF NOT EXISTS idx_token_transactions_stripe_invoice
  ON token_transactions(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;


-- 4. subscriptions: índice para lookup rápido por sub_xxx en webhook ─────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_ref
  ON subscriptions(provider_ref) WHERE provider_ref IS NOT NULL;


-- 5. stripe_events: tabla de idempotencia + auditoría ────────────────────────

CREATE TABLE IF NOT EXISTS stripe_events (
  id            TEXT PRIMARY KEY,             -- evt_xxx (de Stripe)
  type          TEXT NOT NULL,                -- 'checkout.session.completed', etc.
  payload       JSONB NOT NULL,               -- evento crudo (auditoría)
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'processed',
  error_message TEXT
);

-- Constraint: status solo valores válidos
ALTER TABLE stripe_events
  DROP CONSTRAINT IF EXISTS stripe_events_status_check;
ALTER TABLE stripe_events
  ADD CONSTRAINT stripe_events_status_check
  CHECK (status IN ('processed', 'failed', 'skipped'));

-- Índice para búsqueda por tipo (analytics)
CREATE INDEX IF NOT EXISTS idx_stripe_events_type_processed
  ON stripe_events(type, processed_at DESC);

-- RLS: solo admins pueden leer; nadie modifica directo (solo service_role)
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_events_admin_select ON stripe_events;
CREATE POLICY stripe_events_admin_select ON stripe_events
  FOR SELECT USING (is_admin());

-- INSERT/UPDATE/DELETE: ninguno desde RLS — solo service_role bypassa


-- 6. Comentarios para mantenimiento futuro ───────────────────────────────────

COMMENT ON COLUMN profiles.stripe_customer_id IS
  'Stripe Customer ID (cus_xxx) — uno por usuario, sostiene todas sus suscripciones y compras';

COMMENT ON COLUMN profiles.stripe_plan_subscription_id IS
  'Stripe Subscription ID (sub_xxx) del plan Community/Pro/Max del usuario. NULL si está en plan free.';

COMMENT ON COLUMN profiles.plan_status IS
  'Estado del plan: free | trialing | active | past_due | canceled. Sincronizado vía webhook customer.subscription.*';

COMMENT ON COLUMN profiles.plan_current_period_end IS
  'Fin del periodo actual del plan. Usado para renovación y para mostrar fecha de próximo cobro al usuario.';

COMMENT ON COLUMN profiles.plan_cancel_at_period_end IS
  'true cuando el usuario canceló pero aún tiene tiempo restante en el periodo pagado.';

COMMENT ON COLUMN subscriptions.provider_ref IS
  'Stripe Subscription ID (sub_xxx) cuando provider=stripe. Es la suscripción que cubre la membresía base de la empresa.';

COMMENT ON COLUMN company_addons.provider_ref IS
  'Stripe Subscription ID (sub_xxx) del addon individual. Modelo A: cada addon es una suscripción Stripe independiente.';

COMMENT ON COLUMN company_addons.stripe_price_id IS
  'Stripe Price ID (price_xxx) con el que se creó el addon. Útil si cambiamos precios — saber qué addons están al precio viejo.';

COMMENT ON COLUMN token_transactions.stripe_invoice_id IS
  'Stripe Invoice ID (in_xxx) — solo para transacciones tipo purchase que Stripe agrupó en una factura.';

COMMENT ON TABLE stripe_events IS
  'Idempotencia y auditoría de webhooks Stripe. Webhook hace INSERT...ON CONFLICT DO NOTHING para evitar procesar el mismo evento dos veces.';
