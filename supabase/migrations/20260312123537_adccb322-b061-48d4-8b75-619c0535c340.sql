-- Platform settings table (single row for branding config)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL DEFAULT 'PatrolTrack',
  platform_name_accent text NOT NULL DEFAULT 'TRACK',
  page_title text NOT NULL DEFAULT 'PatrolTrack - Monitoramento',
  logo_url text,
  favicon_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read settings
CREATE POLICY "Anyone can read platform settings"
ON public.platform_settings FOR SELECT TO authenticated
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert
CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.platform_settings (platform_name, platform_name_accent, page_title)
VALUES ('PATROL', 'TRACK', 'PatrolTrack - Monitoramento');

-- Trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true);

-- Storage policies
CREATE POLICY "Anyone can view branding" ON storage.objects FOR SELECT TO public USING (bucket_id = 'branding');
CREATE POLICY "Admins can upload branding" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update branding" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete branding" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));