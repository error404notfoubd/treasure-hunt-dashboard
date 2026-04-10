-- =============================================================================
--  DROP ALL — destructive teardown (combines sql/Drop/*.sql + Create extras)
--  BACK UP YOUR DATABASE FIRST. Survey / rate-limit features need Create_All
--  (or numbered Create/*.sql) again after this. Does NOT drop public.profiles.
--
--  Order: dependents first; uses IF EXISTS where supported. Repeats some
--  statements from individual Drop files so this file alone matches their
--  combined effect (profiles / auth triggers are out of scope—see README).
-- =============================================================================

-- ── sql/Drop/Drop View Redacted.sql ─────────────────────────────────────────
DROP VIEW IF EXISTS public.survey_responses_redacted;

-- ── sql/Drop/Drop Verification Codes.sql ────────────────────────────────────
DROP TABLE IF EXISTS public.verification_codes CASCADE;
DROP FUNCTION IF EXISTS public.fn_otp_send_count_for_phone(text, int);

-- ── sql/Drop/Drop Survey Responses.sql ──────────────────────────────────────
DROP TABLE IF EXISTS public.verification_codes CASCADE;
DROP VIEW IF EXISTS public.survey_responses_redacted;
DROP TABLE IF EXISTS public.survey_responses CASCADE;
DROP FUNCTION IF EXISTS public.fn_email_exists(text);
DROP FUNCTION IF EXISTS public.fn_phone_exists(text);
DROP FUNCTION IF EXISTS public.fn_survey_latest_for_normalized_phone(text);
DROP FUNCTION IF EXISTS public.fn_otp_send_count_for_phone(text, int);

-- ── sql/Drop/Drop Rate Limit Log.sql ────────────────────────────────────────
DROP TABLE IF EXISTS public.rate_limit_log CASCADE;
DROP FUNCTION IF EXISTS public.fn_ip_submission_count(inet, int);
DROP FUNCTION IF EXISTS public.fn_clean_rate_log();

-- ── sql/Drop/Drop Rate Limit Events.sql ─────────────────────────────────────
DROP TABLE IF EXISTS public.rate_limit_events CASCADE;
DROP FUNCTION IF EXISTS public.fn_check_and_record_rate_limit(inet, text, int, int);
DROP FUNCTION IF EXISTS public.fn_clean_rate_limit_events();

-- ── Create/04_audit_log.sql (no separate Drop/*.sql in repo) ───────────────
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP FUNCTION IF EXISTS public.fn_audit_log();
