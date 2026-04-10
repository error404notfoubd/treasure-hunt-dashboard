-- ═══════════════════════════════════════════════════════════════
--  MIGRATION: Approval Flow + Audit Actor Attribution
--  Run this on an EXISTING database (after auth_supabase_setup.sql).
--  Safe to run multiple times — all operations are idempotent.
-- ═══════════════════════════════════════════════════════════════


-- 1. Add approval status to profiles
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

-- Add constraint (drop first in case it exists with different values)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE public.profiles
  ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'));

-- Mark ALL existing users as approved (they were already using the system)
UPDATE public.profiles SET status = 'approved' WHERE status != 'approved';

-- Now change the default for NEW signups to 'pending'
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);


-- 2. Update the signup trigger to set status = 'pending'
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'viewer'),
    'pending'
  );
  RETURN new;
END;
$$;


-- 3. Widen audit_log.row_id to text (supports both bigint IDs and UUIDs)
-- ─────────────────────────────────────────────
ALTER TABLE public.audit_log ALTER COLUMN row_id TYPE text USING row_id::text;


-- 4. Drop auto-trigger on survey_responses
--    (API routes now log audit entries with proper actor attribution)
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_survey_audit ON public.survey_responses;


-- 5. Unique constraints on email and name
-- ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_name_unique
  ON public.profiles (lower(full_name))
  WHERE full_name IS NOT NULL AND full_name != '';


-- 6. Verification
-- ─────────────────────────────────────────────
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'status';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_log'
  AND column_name = 'row_id';
