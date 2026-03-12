-- Create role system
CREATE TYPE public.app_role AS ENUM ('admin', 'patroller');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Fix overly permissive policies
DROP POLICY "Admins can insert patrollers" ON public.patrollers;
DROP POLICY "Admins can delete patrollers" ON public.patrollers;
DROP POLICY "Patrollers can insert their locations" ON public.patrol_locations;

CREATE POLICY "Admins can insert patrollers" ON public.patrollers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete patrollers" ON public.patrollers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Patrollers can insert own locations" ON public.patrol_locations FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.patrollers WHERE id = patroller_id AND user_id = auth.uid())
);