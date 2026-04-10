-- ═══════════════════════════════════════════════════════════════════════════
--  DROP: SURVEY RESPONSES
--  ⚠️  DESTRUCTIVE — deletes all survey data permanently.
--  Note: Also drops verification_codes (FK dependency) and the redacted view.
-- ═══════════════════════════════════════════════════════════════════════════

-- Children / dependents first
DROP TABLE IF EXISTS public.verification_codes CASCADE;
DROP VIEW IF EXISTS public.survey_responses_redacted;

-- The table
DROP TABLE IF EXISTS public.survey_responses CASCADE;

-- Related functions
DROP FUNCTION IF EXISTS public.fn_email_exists(text);
DROP FUNCTION IF EXISTS public.fn_phone_exists(text);
DROP FUNCTION IF EXISTS public.fn_survey_latest_for_normalized_phone(text);
DROP FUNCTION IF EXISTS public.fn_otp_send_count_for_phone(text, int);
