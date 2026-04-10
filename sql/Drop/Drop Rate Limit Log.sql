-- ═══════════════════════════════════════════════════════════════════════════
--  DROP: RATE LIMIT LOG
--  ⚠️  DESTRUCTIVE — deletes all rate limit log data permanently.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.rate_limit_log CASCADE;

-- Related functions
DROP FUNCTION IF EXISTS public.fn_ip_submission_count(inet, int);
DROP FUNCTION IF EXISTS public.fn_clean_rate_log();
