-- Migración: Tabla payment_history (historial unificado de pagos)
-- ────────────────────────────────────────────────────────────────────────
-- Razón: las tablas existentes tienen alcance limitado:
--   - token_transactions: solo movimientos de tokens, no captura cobros de plan/addons
--   - subscriptions, company_addons: solo estado actual, no historial de cobros mes a mes
--
-- payment_history guarda un registro por cada cargo exitoso o fallido sin importar
-- de qué tipo de compra venga. Llenada por el webhook stripe-webhook en eventos:
--   - invoice.paid              → status='succeeded'
--   - invoice.payment_failed    → status='failed'
--   - payment_intent.succeeded  → status='succeeded' (one-time, sin invoice)
--   - charge.refunded           → UPDATE status='refunded' o 'partial_refund'
--
-- Usada por:
--   - Pantalla "Historial de pagos" del usuario en /app/billing
--   - Métricas de admin (MRR, ARR, churn) en /app/admin
--   - Soporte: cuando usuario reclama un cobro
--   - Auditoría (cumplimiento legal de transacciones)
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_history (
  -- PK: usamos el invoice_id de Stripe (in_xxx). Para one-time sin invoice,
  -- usamos el payment_intent_id (pi_xxx).
  id TEXT PRIMARY KEY,

  -- Quién pagó
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
                              -- null cuando es plan global o token package

  -- Qué se compró
  purchase_type TEXT NOT NULL,
                              -- 'plan' | 'extra_company' | 'extra_member' | 'token_package'
  description   TEXT,         -- texto legible: "Plan Pro mensual", "1.000 tokens IA", etc.

  -- Cuánto y cuándo
  amount_cents INTEGER NOT NULL,           -- centavos para precisión ($19.99 → 1999)
  currency     TEXT NOT NULL DEFAULT 'usd',
  paid_at      TIMESTAMPTZ,                -- null si está pending/failed

  -- Estado del pago
  status         TEXT NOT NULL,            -- ver constraint abajo
  failure_reason TEXT,                     -- llenado cuando status='failed'

  -- IDs de Stripe (trazabilidad completa)
  stripe_invoice_id        TEXT,           -- in_xxx
  stripe_payment_intent_id TEXT,           -- pi_xxx
  stripe_charge_id         TEXT,           -- ch_xxx
  stripe_subscription_id   TEXT,           -- sub_xxx (cuando viene de subscription)
  stripe_customer_id       TEXT NOT NULL,  -- cus_xxx

  -- Info de la tarjeta (Stripe nos lo da en eventos — público-seguro)
  card_brand TEXT,                         -- 'visa', 'mastercard', etc.
  card_last4 TEXT,                         -- '4242'

  -- Links a recibo y factura PDF
  receipt_url     TEXT,                    -- recibo público de Stripe
  invoice_pdf_url TEXT,                    -- PDF de factura

  -- Metadata adicional (info no estructurada de Stripe)
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints ────────────────────────────────────────────────────────────────

ALTER TABLE payment_history
  DROP CONSTRAINT IF EXISTS payment_history_purchase_type_check;
ALTER TABLE payment_history
  ADD CONSTRAINT payment_history_purchase_type_check
  CHECK (purchase_type IN ('plan', 'extra_company', 'extra_member', 'token_package'));

ALTER TABLE payment_history
  DROP CONSTRAINT IF EXISTS payment_history_status_check;
ALTER TABLE payment_history
  ADD CONSTRAINT payment_history_status_check
  CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded', 'partial_refund'));

ALTER TABLE payment_history
  DROP CONSTRAINT IF EXISTS payment_history_amount_positive;
ALTER TABLE payment_history
  ADD CONSTRAINT payment_history_amount_positive
  CHECK (amount_cents >= 0);

-- Índices ────────────────────────────────────────────────────────────────────

-- Listar pagos del usuario más recientes primero (caso uso #1)
CREATE INDEX IF NOT EXISTS idx_payment_history_user_paid
  ON payment_history(user_id, paid_at DESC NULLS LAST);

-- Pagos por empresa (admin / billing por empresa)
CREATE INDEX IF NOT EXISTS idx_payment_history_company
  ON payment_history(company_id, paid_at DESC NULLS LAST)
  WHERE company_id IS NOT NULL;

-- Alertas: cobros fallidos o pendientes (caso uso: dashboard de admin)
CREATE INDEX IF NOT EXISTS idx_payment_history_status_alerts
  ON payment_history(status, created_at DESC)
  WHERE status IN ('failed', 'pending');

-- Lookup por payment_intent (idempotencia de webhook)
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_intent
  ON payment_history(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Lookup por subscription (para reportes de plan/addon)
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription
  ON payment_history(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;


-- Trigger updated_at ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION payment_history_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_history_updated_at ON payment_history;
CREATE TRIGGER payment_history_updated_at
  BEFORE UPDATE ON payment_history
  FOR EACH ROW EXECUTE FUNCTION payment_history_set_updated_at();


-- RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Usuario ve solo sus propios pagos. Admin ve todo.
DROP POLICY IF EXISTS payment_history_select_own ON payment_history;
CREATE POLICY payment_history_select_own ON payment_history
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- INSERT/UPDATE/DELETE: solo service_role (Edge Functions). RLS bloquea
-- cualquier mutación desde el cliente, lo cual es correcto: payment_history
-- solo se llena desde webhooks Stripe verificados.


-- Comentarios ────────────────────────────────────────────────────────────────

COMMENT ON TABLE payment_history IS
  'Historial unificado de pagos: cada cargo exitoso, fallido, reembolsado o disputado. Llenado por webhook stripe-webhook tras eventos invoice.paid, invoice.payment_failed, payment_intent.succeeded, charge.refunded.';

COMMENT ON COLUMN payment_history.id IS
  'PK: stripe_invoice_id (in_xxx) cuando viene de subscription, o stripe_payment_intent_id (pi_xxx) cuando es one-time sin invoice.';

COMMENT ON COLUMN payment_history.purchase_type IS
  'Tipo de compra: plan (Community/Pro/Max), extra_company (empresa addon), extra_member (miembro addon), token_package (compra única de tokens).';

COMMENT ON COLUMN payment_history.amount_cents IS
  'Monto en centavos. Usar centavos evita errores de redondeo en floats. $19.99 → 1999.';

COMMENT ON COLUMN payment_history.status IS
  'Estado del cobro: succeeded (cobrado OK) | pending (en proceso) | failed (rechazado) | refunded (reembolso completo) | partial_refund.';

COMMENT ON COLUMN payment_history.card_last4 IS
  'Últimos 4 dígitos de la tarjeta. Stripe lo provee en eventos — es público-seguro mostrarlo. NUNCA guardar el número completo, expiry, ni CVV.';
