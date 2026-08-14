-- profiles: admin puede ver todos los perfiles
CREATE POLICY "admin_select_all_profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- token_wallets: admin puede ver todas las wallets
CREATE POLICY "admin_select_all_wallets"
  ON token_wallets FOR SELECT
  USING (is_admin());

-- token_transactions: admin puede ver todas las transacciones
CREATE POLICY "admin_select_all_transactions"
  ON token_transactions FOR SELECT
  USING (is_admin());

-- ai_usage_log: limpiar policy duplicada (mantener admin + own)
DROP POLICY IF EXISTS "ai_usage_log_select" ON ai_usage_log;
