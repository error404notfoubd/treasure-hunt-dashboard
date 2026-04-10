-- ═══════════════════════════════════════════════════════════════════════════
--  DROP: RATE LIMIT EVENTS
--  ⚠️  DESTRUCTIVE — deletes all rate limit event data permanently.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.rate_limit_events CASCADE;

-- Related functions
DROP FUNCTION IF EXISTS public.fn_check_and_record_rate_limit(inet, text, int, int);
DROP FUNCTION IF EXISTS public.fn_clean_rate_limit_events();
