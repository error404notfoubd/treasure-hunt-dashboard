-- ═══════════════════════════════════════════════════════════════════════════
--  00. SCHEMA BASELINE — least privilege; service_role + controlled access
--  Run first before any other migration file.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON SCHEMA public FROM authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
