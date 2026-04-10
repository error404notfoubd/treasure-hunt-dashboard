-- ═══════════════════════════════════════════════════════════════════════════
--  06. RATE LIMIT EVENTS — per-IP per-route; serverless-safe
--  Depends on: 00_schema_baseline.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id           bigserial   PRIMARY KEY,
  ip_address   inet        NOT NULL,
  route        text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ── Indexes ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rate_events_ip_route_time
  ON public.rate_limit_events (ip_address, route, created_at DESC);


-- ── RLS + Grants ─────────────────────────────
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_anon_all_rate_events ON public.rate_limit_events;
CREATE POLICY deny_anon_all_rate_events
  ON public.rate_limit_events AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.rate_limit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_events FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rate_limit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_events_id_seq TO service_role;
