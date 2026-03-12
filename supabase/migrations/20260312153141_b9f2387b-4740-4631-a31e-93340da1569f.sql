CREATE TABLE public.watch_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.watch_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view watch points"
  ON public.watch_points FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Operators and admins can insert watch points"
  ON public.watch_points FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Operators and admins can update watch points"
  ON public.watch_points FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Operators and admins can delete watch points"
  ON public.watch_points FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  );