-- ============================================================
-- Migration: 20260415000001_billing_and_ai_usage
-- Sistema de tokens IA + paquetes de compra + historial
-- ============================================================

-- 1. token_wallets: balance de tokens por usuario
CREATE TABLE IF NOT EXISTS public.token_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_allocation INTEGER NOT NULL DEFAULT 1000,
  used INTEGER NOT NULL DEFAULT 0,
  bonus_balance INTEGER NOT NULL DEFAULT 0,
  renewal_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  plan_id TEXT NOT NULL DEFAULT 'community',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT token_wallets_user_id_unique UNIQUE (user_id)
);

-- 2. operation_costs: costo en tokens por operación IA (parametrizable desde admin)
CREATE TABLE IF NOT EXISTS public.operation_costs (
  key TEXT PRIMARY KEY,
  tokens INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('simple', 'media', 'alta')),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Seed operation_costs con valores por defecto
INSERT INTO public.operation_costs (key, tokens, tier, description) VALUES
  ('process_objective',          5,  'simple', 'Generar objetivo del proceso'),
  ('sipoc',                     10,  'media',  'Generar SIPOC'),
  ('indicators',                10,  'media',  'Generar indicadores KPI'),
  ('procedure_from_context',    10,  'media',  'Generar procedimiento desde contexto'),
  ('procedure_from_bpmn',       10,  'media',  'Generar procedimiento desde BPMN'),
  ('risks_from_bpmn',           10,  'media',  'Identificar riesgos desde BPMN'),
  ('audit_recommendations',     10,  'media',  'Generar programa de auditoría'),
  ('advisor_chat_turn',         10,  'media',  'Turno de chat con consultor'),
  ('process_map_onboarding_turn',10, 'media',  'Turno de onboarding conversacional'),
  ('bpmn_from_interview',       15,  'alta',   'Generar BPMN desde entrevista'),
  ('bpmn_refine',               15,  'alta',   'Refinar diagrama BPMN'),
  ('flowchart_interview_turn',  15,  'alta',   'Turno de entrevista flowchart'),
  ('value_classification',      10,  'media',  'Clasificar actividades VA/NVA/NVABN'),
  ('improve_text',               5,  'simple', 'Mejorar texto de sección')
ON CONFLICT (key) DO NOTHING;

-- 4. plan_token_allocations: tokens mensuales por plan (parametrizable desde admin)
CREATE TABLE IF NOT EXISTS public.plan_token_allocations (
  plan_id TEXT PRIMARY KEY,
  tokens_monthly INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.plan_token_allocations (plan_id, tokens_monthly) VALUES
  ('free',       100),
  ('community', 1000),
  ('pro',       5000),
  ('max',      20000)
ON CONFLICT (plan_id) DO NOTHING;

-- 5. token_packages: paquetes de compra one-time
CREATE TABLE IF NOT EXISTS public.token_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  stripe_price_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.token_packages (id, name, tokens, price_usd) VALUES
  ('pkg_200',  '200 Tokens',    200,   4.99),
  ('pkg_500',  '500 Tokens',    500,   9.99),
  ('pkg_1000', '1,000 Tokens', 1000,  17.99),
  ('pkg_5000', '5,000 Tokens', 5000,  69.99)
ON CONFLICT (id) DO NOTHING;

-- 6. addon_prices: precios de add-ons parametrizables desde admin
CREATE TABLE IF NOT EXISTS public.addon_prices (
  key TEXT PRIMARY KEY,
  price_usd DECIMAL(10,2) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.addon_prices (key, price_usd, description) VALUES
  ('extra_company',    29.99, 'Empresa adicional por mes'),
  ('extra_member',      9.99, 'Miembro adicional por mes'),
  ('priority_support', 19.99, 'Soporte prioritario por mes')
ON CONFLICT (key) DO NOTHING;

-- 7. token_transactions: log completo de todas las operaciones de tokens
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('consume', 'grant', 'purchase', 'renewal', 'refund')),
  tokens INTEGER NOT NULL,
  operation_key TEXT REFERENCES public.operation_costs(key) ON DELETE SET NULL,
  price_usd DECIMAL(10,2),
  stripe_payment_intent_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON public.token_transactions(created_at DESC);

-- 8. RPC atómica consume_ai_tokens — usa FOR UPDATE para evitar race conditions
CREATE OR REPLACE FUNCTION public.consume_ai_tokens(
  p_user_id UUID,
  p_operation_key TEXT,
  p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost INTEGER;
  v_wallet public.token_wallets%ROWTYPE;
  v_available INTEGER;
  v_monthly_remaining INTEGER;
  v_from_bonus INTEGER;
BEGIN
  -- Obtener costo de la operación
  SELECT tokens INTO v_cost FROM public.operation_costs WHERE key = p_operation_key;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'operation_not_found');
  END IF;

  -- Lockear la fila del wallet para evitar race conditions
  SELECT * INTO v_wallet FROM public.token_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet_not_found');
  END IF;

  -- Calcular tokens disponibles (mensual restante + bonus)
  v_available := (v_wallet.monthly_allocation - v_wallet.used) + v_wallet.bonus_balance;
  IF v_available < v_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_tokens',
      'available', v_available,
      'required', v_cost
    );
  END IF;

  -- Descontar: primero del allocation mensual, luego del bonus
  v_monthly_remaining := v_wallet.monthly_allocation - v_wallet.used;
  IF v_monthly_remaining >= v_cost THEN
    UPDATE public.token_wallets
    SET used = used + v_cost, updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    v_from_bonus := v_cost - v_monthly_remaining;
    UPDATE public.token_wallets
    SET used = monthly_allocation,
        bonus_balance = bonus_balance - v_from_bonus,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Registrar transacción
  INSERT INTO public.token_transactions (user_id, company_id, type, tokens, operation_key)
  VALUES (p_user_id, p_company_id, 'consume', v_cost, p_operation_key);

  RETURN jsonb_build_object('success', true, 'tokens_consumed', v_cost);
END;
$$;

-- 9. RLS — token_wallets
ALTER TABLE public.token_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own wallet" ON public.token_wallets;
DROP POLICY IF EXISTS "System updates wallet" ON public.token_wallets;
CREATE POLICY "Users see own wallet" ON public.token_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System updates wallet" ON public.token_wallets FOR ALL USING (auth.uid() = user_id);

-- 10. RLS — token_transactions
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own transactions" ON public.token_transactions;
DROP POLICY IF EXISTS "System inserts transactions" ON public.token_transactions;
CREATE POLICY "Users see own transactions" ON public.token_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts transactions" ON public.token_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 11. RLS — operation_costs (lectura pública, escritura solo admin)
ALTER TABLE public.operation_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone reads costs" ON public.operation_costs;
DROP POLICY IF EXISTS "Admin writes costs" ON public.operation_costs;
CREATE POLICY "Everyone reads costs" ON public.operation_costs FOR SELECT USING (true);
CREATE POLICY "Admin writes costs" ON public.operation_costs FOR ALL USING (public.is_admin());

-- 12. RLS — token_packages
ALTER TABLE public.token_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone reads packages" ON public.token_packages;
DROP POLICY IF EXISTS "Admin writes packages" ON public.token_packages;
CREATE POLICY "Everyone reads packages" ON public.token_packages FOR SELECT USING (active = true);
CREATE POLICY "Admin writes packages" ON public.token_packages FOR ALL USING (public.is_admin());

-- 13. RLS — plan_token_allocations
ALTER TABLE public.plan_token_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone reads allocations" ON public.plan_token_allocations;
DROP POLICY IF EXISTS "Admin writes allocations" ON public.plan_token_allocations;
CREATE POLICY "Everyone reads allocations" ON public.plan_token_allocations FOR SELECT USING (true);
CREATE POLICY "Admin writes allocations" ON public.plan_token_allocations FOR ALL USING (public.is_admin());

-- 14. RLS — addon_prices
ALTER TABLE public.addon_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone reads addon prices" ON public.addon_prices;
DROP POLICY IF EXISTS "Admin writes addon prices" ON public.addon_prices;
CREATE POLICY "Everyone reads addon prices" ON public.addon_prices FOR SELECT USING (true);
CREATE POLICY "Admin writes addon prices" ON public.addon_prices FOR ALL USING (public.is_admin());
