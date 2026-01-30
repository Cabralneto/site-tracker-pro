-- =====================================================
-- PROFILES TABLE: Restrict SELECT to own profile only
-- Removes admin-wide SELECT policy to prevent email harvesting
-- Admin access to profiles now goes through edge function
-- =====================================================

-- Drop the overly permissive admin SELECT policy
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

-- Keep existing policies:
-- - "User can view own profile" (id = auth.uid()) - SELECT
-- - "User can update own profile" (id = auth.uid()) - UPDATE
-- - "User can insert own profile" - INSERT
-- - "Admin can update all profiles" - UPDATE (needed for role management via edge function)

-- Note: Admin operations now use edge function with service role key
-- which bypasses RLS entirely for privileged operations