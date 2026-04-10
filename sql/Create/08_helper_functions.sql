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
