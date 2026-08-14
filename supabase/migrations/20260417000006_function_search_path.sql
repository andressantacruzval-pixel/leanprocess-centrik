-- Paso 10b del plan — fijar search_path en los 7 helpers RLS y utilidades que el
-- advisor de seguridad reporta como `function_search_path_mutable` (H-20).
-- Endurecer el search_path previene ataques de search_path hijacking en SECURITY DEFINER.

ALTER FUNCTION public.is_company_member(uuid)              SET search_path = public, pg_temp;
ALTER FUNCTION public.is_company_editor(uuid)              SET search_path = public, pg_temp;
ALTER FUNCTION public.is_company_owner(uuid)               SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.consume_ai_tokens(uuid, text, uuid)   SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at()                     SET search_path = public, pg_temp;
