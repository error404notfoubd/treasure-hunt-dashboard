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

DROP POLICY IF EXISTS deny_anon_all_verification_codes ON public.verification_codes;
CREATE POLICY deny_anon_all_verification_codes
  ON public.verification_codes AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.verification_codes FROM PUBLIC;
REVOKE ALL ON TABLE public.verification_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.verification_codes TO service_role;
