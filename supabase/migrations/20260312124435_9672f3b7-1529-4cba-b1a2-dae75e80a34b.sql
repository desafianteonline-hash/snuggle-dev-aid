ALTER TABLE public.platform_settings
  ADD COLUMN primary_color text DEFAULT '142 70% 45%',
  ADD COLUMN background_color text DEFAULT '220 20% 7%',
  ADD COLUMN card_color text DEFAULT '220 18% 10%',
  ADD COLUMN accent_color text DEFAULT '142 50% 30%',
  ADD COLUMN theme_preset text DEFAULT 'default';

UPDATE public.platform_settings
SET primary_color = '142 70% 45%',
    background_color = '220 20% 7%',
    card_color = '220 18% 10%',
    accent_color = '142 50% 30%',
    theme_preset = 'default';