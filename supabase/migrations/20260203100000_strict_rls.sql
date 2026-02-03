-- Helper function to get agency_id of the current authenticated user
-- SECURITY DEFINER is used to bypass RLS on the users table itself
CREATE OR REPLACE FUNCTION public.get_my_agency_id()
RETURNS UUID AS $$
    SELECT agency_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Ensure RLS is enabled on all key tables
ALTER TABLE IF EXISTS public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.proposals ENABLE ROW LEVEL SECURITY;

-- 1. AGENCIES POLICIES
-- Users can only see the agency they belong to
DROP POLICY IF EXISTS "Agencies are visible by their members" ON public.agencies;
CREATE POLICY "Agencies are visible by their members" 
ON public.agencies FOR SELECT 
TO authenticated
USING (id = public.get_my_agency_id());

-- Only supervisors or admins can update agency settings (branding, name)
DROP POLICY IF EXISTS "Management can update agency" ON public.agencies;
CREATE POLICY "Management can update agency" 
ON public.agencies FOR UPDATE 
TO authenticated
USING (
    id = public.get_my_agency_id() AND 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

-- 2. DOCUMENTS POLICIES
-- Full isolation by agency_id
DROP POLICY IF EXISTS "Documents are isolated by agency" ON public.documents;
CREATE POLICY "Documents are isolated by agency" 
ON public.documents FOR ALL 
TO authenticated
USING (agency_id = public.get_my_agency_id())
WITH CHECK (agency_id = public.get_my_agency_id());

-- 3. PROPOSALS POLICIES
-- Full isolation by agency_id
DROP POLICY IF EXISTS "Proposals are isolated by agency" ON public.proposals;
CREATE POLICY "Proposals are isolated by agency" 
ON public.proposals FOR ALL 
TO authenticated
USING (agency_id = public.get_my_agency_id())
WITH CHECK (agency_id = public.get_my_agency_id());

-- 4. USERS POLICIES
-- Users can see their own profile and profiles of others in the same agency
DROP POLICY IF EXISTS "Users can see themselves and coworkers" ON public.users;
CREATE POLICY "Users can see themselves and coworkers" 
ON public.users FOR SELECT 
TO authenticated
USING (agency_id = public.get_my_agency_id() OR id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" 
ON public.users FOR UPDATE 
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
