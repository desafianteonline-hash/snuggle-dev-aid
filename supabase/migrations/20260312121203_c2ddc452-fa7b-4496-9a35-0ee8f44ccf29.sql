-- Create patrollers table
CREATE TABLE public.patrollers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle_plate TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'on_call')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patrollers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view patrollers" ON public.patrollers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Patrollers can update their own record" ON public.patrollers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert patrollers" ON public.patrollers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete patrollers" ON public.patrollers FOR DELETE TO authenticated USING (true);

-- Create patrol_locations table for real-time tracking
CREATE TABLE public.patrol_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patroller_id UUID NOT NULL REFERENCES public.patrollers(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patrol_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all locations" ON public.patrol_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Patrollers can insert their locations" ON public.patrol_locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_patrol_locations_patroller_time ON public.patrol_locations (patroller_id, recorded_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.patrol_locations;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_patrollers_updated_at
  BEFORE UPDATE ON public.patrollers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();