-- ═══════════════════════════════════════════════════════════════════════════
--  05. RATE LIMIT LOG — submission / IP tracking
--  Depends on: 00_schema_baseline.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id           bigserial   PRIMARY KEY,
  ip_address   inet        NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success      boolean     NOT NULL DEFAULT false
);


-- ── Indexes ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rate_ip_time
  ON public.rate_limit_log (ip_address, attempted_at DESC);


-- ── RLS + Grants ─────────────────────────────
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rate_limit_log'
      AND policyname = 'deny_anon_all_rate'
  ) THEN
    CREATE POLICY deny_anon_all_rate
      ON public.rate_limit_log AS RESTRICTIVE
      FOR ALL
      TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $$;

REVOKE ALL ON TABLE public.rate_limit_log FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_log FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rate_limit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_log_id_seq TO service_role;
