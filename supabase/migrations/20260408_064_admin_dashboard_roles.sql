-- ═══════════════════════════════════════════════════════════════════
-- VITOGRAPH: Admin Dashboard & Global App Settings Roles
-- Execute manually in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create a function to check if the current user is an admin
-- It reads the 'role' field from app_metadata in the JWT.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', 
    ''
  ) = 'admin';
$$;

-- 2. Configure RLS for _app_config to allow DB and Service Role management
ALTER TABLE _app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and service_role can read config" ON _app_config 
    FOR SELECT 
    USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins and service_role can insert config" ON _app_config 
    FOR INSERT 
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins and service_role can update config" ON _app_config 
    FOR UPDATE 
    USING (public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admins and service_role can delete config" ON _app_config 
    FOR DELETE 
    USING (public.is_admin() OR auth.role() = 'service_role');

-- 3. Extend kb_documents to allow admins to manage documents
CREATE POLICY "Admins can manage kb_documents" ON kb_documents
    FOR ALL 
    USING (public.is_admin());

-- Notice for giving a user admin rights:
-- DO NOT UNCOMMENT THIS QUERY. RUN IT WITH YOUR REAL EMAIL.
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb WHERE email = 'your@email.com';
