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
