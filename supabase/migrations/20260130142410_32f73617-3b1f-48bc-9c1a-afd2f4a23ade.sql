-- =====================================================
-- INVITE SYSTEM: Add columns to profiles table
-- =====================================================

-- Add columns to profiles for invite system
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS invite_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

-- Update existing users to have force_password_change = false (they already have passwords)
UPDATE public.profiles
SET force_password_change = false
WHERE force_password_change IS NULL OR force_password_change = true;

-- =====================================================
-- ADMIN AUDIT LOG: Create table for tracking admin actions
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit log
CREATE POLICY "Admins can view audit log"
ON public.admin_audit_log
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Only the system (via service role) can insert - no direct insert policy
-- Inserts happen via edge functions with service role key

-- =====================================================
-- RATE LIMITING: Create table for tracking invite attempts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.invite_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_user_id uuid,
  action_type text NOT NULL, -- 'create' or 'resend'
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (no public access, only via service role)
ALTER TABLE public.invite_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_invite_rate_limits_admin_action 
ON public.invite_rate_limits (admin_id, action_type, created_at);

CREATE INDEX IF NOT EXISTS idx_invite_rate_limits_user_resend
ON public.invite_rate_limits (target_user_id, action_type, created_at)
WHERE target_user_id IS NOT NULL;