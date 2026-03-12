import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformSettings {
  id: string;
  platform_name: string;
  platform_name_accent: string;
  page_title: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  background_color: string;
  card_color: string;
  accent_color: string;
  theme_preset: string;
}

const defaultSettings: PlatformSettings = {
  id: '',
  platform_name: 'PATROL',
  platform_name_accent: 'TRACK',
  page_title: 'PatrolTrack - Monitoramento',
  logo_url: null,
  favicon_url: null,
  primary_color: '142 70% 45%',
  background_color: '220 20% 7%',
  card_color: '220 18% 10%',
  accent_color: '142 50% 30%',
  theme_preset: 'default',
};

// Preset themes
export const THEME_PRESETS: Record<string, { label: string; primary: string; background: string; card: string; accent: string }> = {
  default: { label: 'Padrão (Verde)', primary: '142 70% 45%', background: '220 20% 7%', card: '220 18% 10%', accent: '142 50% 30%' },
  blue: { label: 'Azul Profundo', primary: '217 91% 60%', background: '222 47% 7%', card: '222 40% 10%', accent: '217 70% 35%' },
  red: { label: 'Vermelho Tático', primary: '0 72% 51%', background: '0 10% 7%', card: '0 8% 10%', accent: '0 50% 30%' },
  amber: { label: 'Âmbar Quente', primary: '38 92% 50%', background: '30 15% 7%', card: '30 12% 10%', accent: '38 60% 30%' },
  purple: { label: 'Roxo Noturno', primary: '270 70% 55%', background: '270 20% 7%', card: '270 18% 10%', accent: '270 50% 30%' },
  cyan: { label: 'Ciano Tech', primary: '185 80% 45%', background: '200 25% 7%', card: '200 20% 10%', accent: '185 50% 30%' },
};

function applyThemeColors(settings: PlatformSettings) {
  const root = document.documentElement;
  if (settings.primary_color) {
    root.style.setProperty('--primary', settings.primary_color);
    root.style.setProperty('--ring', settings.primary_color);
    root.style.setProperty('--sidebar-primary', settings.primary_color);
    root.style.setProperty('--sidebar-ring', settings.primary_color);
    // Derive primary foreground (dark on light primary, light on dark)
    const lightness = parseInt(settings.primary_color.split('%')[1] || '45');
    root.style.setProperty('--primary-foreground', lightness > 55 ? '220 20% 7%' : '220 20% 7%');
  }
  if (settings.background_color) {
    root.style.setProperty('--background', settings.background_color);
    root.style.setProperty('--sidebar-background', settings.background_color);
  }
  if (settings.card_color) {
    root.style.setProperty('--card', settings.card_color);
    root.style.setProperty('--card-foreground', '210 20% 92%');
    root.style.setProperty('--popover', settings.card_color);
    // Derive secondary/muted from card
    const parts = settings.card_color.split(' ');
    const hue = parseInt(parts[0] || '220');
    root.style.setProperty('--secondary', `${hue} 16% 16%`);
    root.style.setProperty('--muted', `${hue} 14% 14%`);
    root.style.setProperty('--border', `${hue} 14% 18%`);
    root.style.setProperty('--input', `${hue} 14% 18%`);
    root.style.setProperty('--sidebar-border', `${hue} 14% 18%`);
    root.style.setProperty('--sidebar-accent', `${hue} 16% 14%`);
  }
  if (settings.accent_color) {
    root.style.setProperty('--accent', settings.accent_color);
    // Derive accent foreground
    const parts = settings.accent_color.split(' ');
    const hue = parseInt(parts[0] || '142');
    root.style.setProperty('--accent-foreground', `${hue} 70% 85%`);
  }
}

const PlatformContext = createContext<{
  settings: PlatformSettings;
  loading: boolean;
  refetch: () => void;
}>({ settings: defaultSettings, loading: true, refetch: () => {} });

export function usePlatformSettings() {
  return useContext(PlatformContext);
}

export function PlatformSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      const s = data as PlatformSettings;
      setSettings(s);
      document.title = s.page_title || 'PatrolTrack';
      if (s.favicon_url) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = s.favicon_url;
      }
      applyThemeColors(s);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <PlatformContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
      {children}
    </PlatformContext.Provider>
  );
}
