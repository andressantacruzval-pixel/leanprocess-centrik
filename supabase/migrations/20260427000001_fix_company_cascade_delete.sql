-- ============================================================================
-- Fix: agregar ON DELETE CASCADE a las 12 FKs company_id que tenían NO ACTION
-- Problema: DELETE en companies fallaba con 409 porque las tablas hijas
-- bloqueaban la eliminación. macroprocesses y processes ya tenían CASCADE.
-- ============================================================================

-- ── audits ───────────────────────────────────────────────────────────────────
ALTER TABLE public.audits
  DROP CONSTRAINT IF EXISTS audits_company_id_fkey,
  ADD CONSTRAINT audits_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── catalog_items ─────────────────────────────────────────────────────────────
ALTER TABLE public.catalog_items
  DROP CONSTRAINT IF EXISTS catalog_items_company_id_fkey,
  ADD CONSTRAINT catalog_items_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── change_log ────────────────────────────────────────────────────────────────
ALTER TABLE public.change_log
  DROP CONSTRAINT IF EXISTS change_log_company_id_fkey,
  ADD CONSTRAINT change_log_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── indicators ────────────────────────────────────────────────────────────────
ALTER TABLE public.indicators
  DROP CONSTRAINT IF EXISTS indicators_company_id_fkey,
  ADD CONSTRAINT indicators_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── notifications ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_company_id_fkey,
  ADD CONSTRAINT notifications_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── procedures ────────────────────────────────────────────────────────────────
ALTER TABLE public.procedures
  DROP CONSTRAINT IF EXISTS procedures_company_id_fkey,
  ADD CONSTRAINT procedures_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── process_level_definitions ─────────────────────────────────────────────────
ALTER TABLE public.process_level_definitions
  DROP CONSTRAINT IF EXISTS process_level_definitions_company_id_fkey,
  ADD CONSTRAINT process_level_definitions_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── risks ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.risks
  DROP CONSTRAINT IF EXISTS risks_company_id_fkey,
  ADD CONSTRAINT risks_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── sipoc_customers ───────────────────────────────────────────────────────────
ALTER TABLE public.sipoc_customers
  DROP CONSTRAINT IF EXISTS sipoc_customers_company_id_fkey,
  ADD CONSTRAINT sipoc_customers_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── sipoc_entries ─────────────────────────────────────────────────────────────
ALTER TABLE public.sipoc_entries
  DROP CONSTRAINT IF EXISTS sipoc_entries_company_id_fkey,
  ADD CONSTRAINT sipoc_entries_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── sipoc_suppliers ───────────────────────────────────────────────────────────
ALTER TABLE public.sipoc_suppliers
  DROP CONSTRAINT IF EXISTS sipoc_suppliers_company_id_fkey,
  ADD CONSTRAINT sipoc_suppliers_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ── value_activities ──────────────────────────────────────────────────────────
ALTER TABLE public.value_activities
  DROP CONSTRAINT IF EXISTS value_activities_company_id_fkey,
  ADD CONSTRAINT value_activities_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
