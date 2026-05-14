-- Migration: 013_lock_down_profile_self_updates
-- Depends on: 010_pin_auth_operational_users.sql
-- Purpose: prevent non-admin users from mutating authorization-sensitive profile fields.

-- The initial schema allowed authenticated users to update their own profile row.
-- Because authorization checks read profiles.role/is_active, that policy can become
-- a privilege-escalation path if a client updates role, team, is_active, login code,
-- or PIN fields. Profile mutations now go through admin-only policies / Edge Functions.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Keep admin-managed profile updates explicit and idempotent.
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

COMMENT ON TABLE public.profiles IS
  'User profiles. Sensitive fields (role, is_active, team, pin_login_code, pin_hash) must only be updated via admin-controlled flows.';
