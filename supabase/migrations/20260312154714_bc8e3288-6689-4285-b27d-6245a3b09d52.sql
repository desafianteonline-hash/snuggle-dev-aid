DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'watch_points'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_points;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'patrollers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patrollers;
  END IF;
END $$;