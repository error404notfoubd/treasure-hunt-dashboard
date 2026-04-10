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
