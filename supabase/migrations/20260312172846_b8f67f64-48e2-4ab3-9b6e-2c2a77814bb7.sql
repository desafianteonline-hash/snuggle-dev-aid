
-- Geofences table
CREATE TABLE public.geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters double precision NOT NULL DEFAULT 200,
  color text NOT NULL DEFAULT '#3b82f6',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view geofences" ON public.geofences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can insert geofences" ON public.geofences
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins and operators can update geofences" ON public.geofences
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins and operators can delete geofences" ON public.geofences
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

-- Geofence events table
CREATE TABLE public.geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id uuid NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  patroller_id uuid NOT NULL REFERENCES public.patrollers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('enter', 'exit')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view geofence events" ON public.geofence_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert geofence events" ON public.geofence_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for geofence_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.geofence_events;
