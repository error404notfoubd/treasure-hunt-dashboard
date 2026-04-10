-- ═══════════════════════════════════════════════════════════════════════════
--  04. AUDIT LOG — append-only via rules; row_id as text
--  Depends on: 00_schema_baseline.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           bigserial    PRIMARY KEY,
  table_name   text         NOT NULL,
  operation    text         NOT NULL,
  row_id       text,
  old_data     jsonb,
  new_data     jsonb,
  performed_at timestamptz  NOT NULL DEFAULT now(),
  performed_by text         NOT NULL DEFAULT current_user
);

ALTER TABLE public.audit_log
  ALTER COLUMN row_id TYPE text USING row_id::text;


-- ── Append-only rules ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_rules
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND rulename = 'audit_no_update'
  ) THEN
    CREATE RULE audit_no_update AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_rules
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND rulename = 'audit_no_delete'
  ) THEN
    CREATE RULE audit_no_delete AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;
  END IF;
END $$;


-- ── RLS + Grants ─────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND policyname = 'deny_anon_all_audit'
  ) THEN
    CREATE POLICY deny_anon_all_audit
      ON public.audit_log AS RESTRICTIVE
      FOR ALL
      TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $$;

REVOKE ALL ON TABLE public.audit_log FROM PUBLIC;
REVOKE ALL ON TABLE public.audit_log FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO service_role;


-- ── Trigger helper function ──────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, operation, row_id, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    coalesce(new.id::text, old.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(old) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(new) ELSE NULL END
  );
  RETURN coalesce(new, old);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_audit_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_audit_log() TO service_role;
