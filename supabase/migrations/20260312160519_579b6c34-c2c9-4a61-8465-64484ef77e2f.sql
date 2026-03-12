DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'platform_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'watch_points'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_points;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'patrol_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patrol_locations;
  END IF;
END $$;