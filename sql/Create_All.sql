-- =============================================================================
--  CREATE ALL -- full schema (sql/Create/00 through 09 in order)
--  Regenerate after editing individual files: see sql/README.md
-- =============================================================================
-- SECTION: Create/00_schema_baseline.sql
-- ═══════════════════════════════════════════════════════════════════════════
--  00. SCHEMA BASELINE — least privilege; service_role + controlled access
--  Run first before any other migration file.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON SCHEMA public FROM authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;


-- SECTION: Create/01_profiles.sql
-- ═══════════════════════════════════════════════════════════════════════════
--  01. PROFILES — never dropped; create-if-missing, then additive alters
--  Depends on: 00_schema_baseline.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       text        NOT NULL,
  full_name   text,
  role        text        NOT NULL DEFAULT 'viewer',
  status      text        NOT NULL DEFAULT 'pending',
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_role CHECK (
    role IN ('owner', 'admin', 'editor', 'viewer')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'approved', 'rejected')
  )
);

-- Additive column alters (safe to re-run)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'viewer',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Check constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'profiles'
      AND c.conname = 'valid_role'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'editor', 'viewer'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'profiles'
      AND c.conname = 'valid_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;


-- ── Indexes ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_name_unique
  ON public.profiles (lower(full_name))
  WHERE full_name IS NOT NULL AND full_name != '';


-- ── Functions ────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'viewer'),
    'pending'
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;


-- ── Triggers ─────────────────────────────────
CREATE OR REPLACE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ── RLS + Policies ───────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Owners can update any profile'
  ) THEN
    CREATE POLICY "Owners can update any profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'owner'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update non-owner profiles'
  ) THEN
    CREATE POLICY "Admins can update non-owner profiles"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
        AND role != 'owner'
      );
  END IF;
END $$;


-- ── Grants ───────────────────────────────────
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


-- SECTION: Create/02_survey_responses.sql
-- ═══════════════════════════════════════════════════════════════════════════
--  02. SURVEY RESPONSES — submissions with verified flag
--  Depends on: 00_schema_baseline.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id              bigserial       PRIMARY KEY,
  name            text            NOT NULL,
  email           text,
  phone           text            NOT NULL,
  frequency       text,
  ip_address      inet,
  user_agent      text,
  submitted_at    timestamptz     NOT NULL DEFAULT now(),
  is_flagged      boolean         NOT NULL DEFAULT false,
  notes           text,
  verified        boolean         NOT NULL DEFAULT false,
  otp_last_sent_at timestamptz
);

-- Additive alters (safe to re-run)
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS otp_last_sent_at timestamptz;


-- ── Constraints (idempotent) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'survey_responses'
      AND c.conname IN ('email_format', 'survey_responses_email_format')
  ) THEN
    ALTER TABLE public.survey_responses
      ADD CONSTRAINT email_format CHECK (
        email IS NULL OR email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'survey_responses'
      AND c.conname IN ('name_length', 'survey_responses_name_length')
  ) THEN
    ALTER TABLE public.survey_responses
      ADD CONSTRAINT name_length CHECK (
        char_length(name) BETWEEN 2 AND 120
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'survey_responses'
      AND c.conname IN ('phone_length', 'survey_responses_phone_length')
  ) THEN
    ALTER TABLE public.survey_responses
      ADD CONSTRAINT phone_length CHECK (
        char_length(phone) BETWEEN 7 AND 20
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'survey_responses'
      AND c.conname IN ('frequency_values', 'survey_responses_frequency_values')
  ) THEN
    ALTER TABLE public.survey_responses
      ADD CONSTRAINT frequency_values CHECK (
        frequency IS NULL OR frequency = '' OR frequency IN (
          'Daily — multiple times a day',
          'Daily — once a day',
          'A few times a week',
          'Once a week',
          'A few times a month',
          'Rarely'
        )
      );
  END IF;
END $$;


-- ── Indexes ──────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_email
  ON public.survey_responses (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_phone
  ON public.survey_responses (regexp_replace(phone, '[^0-9+]', '', 'g'));

CREATE INDEX IF NOT EXISTS idx_survey_submitted_at
  ON public.survey_responses (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_survey_ip
  ON public.survey_responses (ip_address);

CREATE INDEX IF NOT EXISTS idx_survey_flagged
  ON public.survey_responses (is_flagged) WHERE is_flagged = true;


-- ── RLS + Grants ─────────────────────────────
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'survey_responses'
      AND policyname = 'deny_anon_all_survey'
  ) THEN
    CREATE POLICY deny_anon_all_survey
      ON public.survey_responses AS RESTRICTIVE
      FOR ALL
      TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $$;

REVOKE ALL ON TABLE public.survey_responses FROM PUBLIC;
REVOKE ALL ON TABLE public.survey_responses FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.survey_responses TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.survey_responses_id_seq TO service_role;

-- No DB trigger on survey_responses (audit is API-owned); remove legacy trigger if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'survey_responses'
      AND t.tgname = 'trg_survey_audit'
      AND NOT t.tgisinternal
  ) THEN
    DROP TRIGGER trg_survey_audit ON public.survey_responses;
  END IF;
END $$;


-- SECTION: Create/03_verification_codes.sql
-- ═══════════════════════════════════════════════════════════════════════════
--  03. VERIFICATION CODES — SMS OTP metadata; code stored as hash
--  Depends on: 02_survey_responses.sql (FK → survey_responses.id)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.verification_codes (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_response_id  bigint      NOT NULL REFERENCES public.survey_responses (id) ON DELETE CASCADE,
  phone               text        NOT NULL,
  code                text        NOT NULL,
  expires_at          timestamptz NOT NULL,
  used                boolean     NOT NULL DEFAULT false,
  attempts            integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);


-- ── Indexes ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_active
  ON public.verification_codes (phone, created_at DESC)
  WHERE used = false;


-- ── RLS + Grants ─────────────────────────────
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'verification_codes'
      AND policyname = 'deny_anon_all_verification_codes'
  ) THEN
    CREATE POLICY deny_anon_all_verification_codes
      ON public.verification_codes AS RESTRICTIVE
      FOR ALL
      TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $$;

REVOKE ALL ON TABLE public.verification_codes FROM PUBLIC;
REVOKE ALL ON TABLE public.verification_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.verification_codes TO service_role;


-- SECTION: Create/04_audit_log.sql
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


-- SECTION: Create/05_rate_limit_log.sql
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


-- SECTION: Create/06_rate_limit_events.sql
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rate_limit_events'
      AND policyname = 'deny_anon_all_rate_events'
  ) THEN
    CREATE POLICY deny_anon_all_rate_events
      ON public.rate_limit_events AS RESTRICTIVE
      FOR ALL
      TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $$;

REVOKE ALL ON TABLE public.rate_limit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_events FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rate_limit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_events_id_seq TO service_role;


-- SECTION: Create/07_view_redacted.sql
-- ═══════════════════════════════════════════════════════════════════════════
--  07. SECURE VIEW — invoker; inherits caller RLS
--  Depends on: 02_survey_responses.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.survey_responses_redacted
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  regexp_replace(email, '^[^@]+', '****') AS email,
  regexp_replace(phone, '\d(?=\d{3})', '*', 'g') AS phone,
  frequency,
  split_part(ip_address::text, '.', 1) || '.***.***.***' AS ip_address,
  submitted_at,
  is_flagged,
  verified
FROM public.survey_responses;

REVOKE ALL ON TABLE public.survey_responses_redacted FROM PUBLIC;
REVOKE ALL ON TABLE public.survey_responses_redacted FROM anon, authenticated;
GRANT SELECT ON TABLE public.survey_responses_redacted TO service_role;


-- SECTION: Create/08_helper_functions.sql
-- ═══════════════════════════════════════════════════════════════════════════
--  08. HELPER FUNCTIONS + EXECUTE GRANTS
--  Depends on: all tables (01–06)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.fn_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE lower(email) = lower(p_email)
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_phone_exists(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE regexp_replace(phone, '[^0-9+]', '', 'g') =
          regexp_replace(p_phone, '[^0-9+]', '', 'g')
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_survey_latest_for_normalized_phone(p_phone text)
RETURNS TABLE (survey_id bigint, is_verified boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT s.id, s.verified
  FROM public.survey_responses s
  WHERE regexp_replace(s.phone, '[^0-9+]', '', 'g') =
        regexp_replace(p_phone, '[^0-9+]', '', 'g')
  ORDER BY s.submitted_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_ip_submission_count(p_ip inet, p_mins int DEFAULT 15)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.rate_limit_log
  WHERE ip_address = p_ip
    AND success = true
    AND attempted_at > now() - (p_mins || ' minutes')::interval;
$$;

CREATE OR REPLACE FUNCTION public.fn_clean_rate_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_log
  WHERE attempted_at < now() - interval '24 hours';
$$;

CREATE OR REPLACE FUNCTION public.fn_check_and_record_rate_limit(
  p_ip          inet,
  p_route       text,
  p_max         int,
  p_window_secs int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_ip::text || '|' || p_route)::bigint);

  SELECT count(*)::int INTO cnt
  FROM public.rate_limit_events
  WHERE ip_address = p_ip
    AND route = p_route
    AND created_at > now() - (interval '1 second' * p_window_secs);

  IF cnt >= p_max THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_events (ip_address, route)
  VALUES (p_ip, p_route);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_otp_send_count_for_phone(p_phone text, p_window_mins int)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.verification_codes v
  WHERE regexp_replace(v.phone, '[^0-9+]', '', 'g') =
        regexp_replace(p_phone, '[^0-9+]', '', 'g')
    AND v.created_at > now() - (p_window_mins::text || ' minutes')::interval;
$$;

CREATE OR REPLACE FUNCTION public.fn_clean_rate_limit_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_events
  WHERE created_at < now() - interval '3 days';
$$;


-- ── Grants: service_role only ────────────────
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_email_exists(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_phone_exists(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_survey_latest_for_normalized_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ip_submission_count(inet, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_clean_rate_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_check_and_record_rate_limit(inet, text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_otp_send_count_for_phone(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_clean_rate_limit_events() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_email_exists(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_phone_exists(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_survey_latest_for_normalized_phone(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ip_submission_count(inet, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_clean_rate_log() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_check_and_record_rate_limit(inet, text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_otp_send_count_for_phone(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_clean_rate_limit_events() TO service_role;

REVOKE EXECUTE ON FUNCTION public.fn_email_exists(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_phone_exists(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_survey_latest_for_normalized_phone(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_ip_submission_count(inet, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_clean_rate_log() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_check_and_record_rate_limit(inet, text, int, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_otp_send_count_for_phone(text, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_clean_rate_limit_events() FROM anon, authenticated;


-- SECTION: Create/09_verification_queries.sql
-- ═══════════════════════════════════════════════════════════════════════════
--  09. VERIFICATION QUERIES — confirm RLS + policies after running 00–08
-- ═══════════════════════════════════════════════════════════════════════════

SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'survey_responses',
    'verification_codes',
    'audit_log',
    'rate_limit_log',
    'rate_limit_events'
  )
ORDER BY tablename;

SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

