ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS max_speed_limit integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS patrol_interval_seconds integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS idle_timeout_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS min_accuracy_meters integer NOT NULL DEFAULT 50;