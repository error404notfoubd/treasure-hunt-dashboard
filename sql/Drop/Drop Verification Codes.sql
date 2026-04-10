-- ═══════════════════════════════════════════════════════════════════════════
--  DROP: VERIFICATION CODES
--  ⚠️  DESTRUCTIVE — deletes all verification code data permanently.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.verification_codes CASCADE;

-- Related functions
DROP FUNCTION IF EXISTS public.fn_otp_send_count_for_phone(text, int);
