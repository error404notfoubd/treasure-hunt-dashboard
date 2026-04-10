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
