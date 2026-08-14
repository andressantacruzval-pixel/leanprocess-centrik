-- ai_rate_limit_log: registra llamadas al proxy de IA para rate limiting por usuario
-- Cada fila representa una llamada. Se consultan solo las de los últimos 60s.

create table if not exists public.ai_rate_limit_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now() not null
);

-- Índice para lookups rápidos por usuario + ventana de tiempo
create index if not exists ai_rate_limit_log_user_time_idx
  on public.ai_rate_limit_log (user_id, created_at desc);

-- RLS habilitado; el edge function usa service_role y bypassa RLS
alter table public.ai_rate_limit_log enable row level security;

-- Los usuarios solo pueden ver sus propias filas (el edge function usa service_role para escribir)
create policy "Users can view own rate limit log"
  on public.ai_rate_limit_log for select
  using (auth.uid() = user_id);
