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

// Preset themes (dark-mode base colors)
export const THEME_PRESETS: Record<string, { label: string; primary: string; background: string; card: string; accent: string }> = {
  default: { label: 'Padrão (Verde)', primary: '142 70% 45%', background: '220 20% 7%', card: '220 18% 10%', accent: '142 50% 30%' },
  blue: { label: 'Azul Profundo', primary: '217 91% 60%', background: '222 47% 7%', card: '222 40% 10%', accent: '217 70% 35%' },
  red: { label: 'Vermelho Tático', primary: '0 72% 51%', background: '0 10% 7%', card: '0 8% 10%', accent: '0 50% 30%' },
  amber: { label: 'Âmbar Quente', primary: '38 92% 50%', background: '30 15% 7%', card: '30 12% 10%', accent: '38 60% 30%' },
  purple: { label: 'Roxo Noturno', primary: '270 70% 55%', background: '270 20% 7%', card: '270 18% 10%', accent: '270 50% 30%' },
  cyan: { label: 'Ciano Tech', primary: '185 80% 45%', background: '200 25% 7%', card: '200 20% 10%', accent: '185 50% 30%' },
};

function parseHSL(hsl: string): { h: number; s: number; l: number } {
  const parts = hsl.match(/[\d.]+/g) || ['0', '0%', '0%'];
  return {
    h: parseInt(parts[0] || '0'),
    s: parseInt(parts[1] || '0'),
    l: parseInt(parts[2] || '0'),
  };
}

function isLightMode(): boolean {
  return document.documentElement.classList.contains('light');
}

function applyThemeColors(settings: PlatformSettings) {
  const root = document.documentElement;
  const light = isLightMode();

  if (settings.primary_color) {
    const { h, s } = parseHSL(settings.primary_color);
    root.style.setProperty('--primary', settings.primary_color);
    root.style.setProperty('--ring', settings.primary_color);
    root.style.setProperty('--sidebar-primary', settings.primary_color);
    root.style.setProperty('--sidebar-ring', settings.primary_color);
    root.style.setProperty('--primary-foreground', light ? '0 0% 100%' : '220 20% 7%');
    root.style.setProperty('--sidebar-primary-foreground', light ? '0 0% 100%' : '220 20% 7%');
    // Status online follows primary hue
    root.style.setProperty('--status-online', settings.primary_color);
  }

  if (settings.background_color) {
    const { h, s } = parseHSL(settings.background_color);
    if (light) {
      root.style.setProperty('--background', `${h} ${Math.min(s, 20)}% 98%`);
      root.style.setProperty('--sidebar-background', `${h} ${Math.min(s, 20)}% 98%`);
      root.style.setProperty('--foreground', `${h} 20% 10%`);
    } else {
      root.style.setProperty('--background', settings.background_color);
      root.style.setProperty('--sidebar-background', settings.background_color);
      root.style.setProperty('--foreground', '210 20% 92%');
    }
  }

  if (settings.card_color) {
    const { h, s } = parseHSL(settings.card_color);
    if (light) {
      root.style.setProperty('--card', '0 0% 100%');
      root.style.setProperty('--popover', '0 0% 100%');
      root.style.setProperty('--card-foreground', `${h} 20% 10%`);
      root.style.setProperty('--popover-foreground', `${h} 20% 10%`);
      root.style.setProperty('--secondary', `${h} 14% 92%`);
      root.style.setProperty('--secondary-foreground', `${h} 20% 20%`);
      root.style.setProperty('--muted', `${h} 14% 95%`);
      root.style.setProperty('--muted-foreground', `${h} 12% 45%`);
      root.style.setProperty('--border', `${h} 14% 88%`);
      root.style.setProperty('--input', `${h} 14% 88%`);
      root.style.setProperty('--sidebar-border', `${h} 14% 88%`);
      root.style.setProperty('--sidebar-accent', `${h} 14% 94%`);
      root.style.setProperty('--sidebar-foreground', `${h} 20% 30%`);
      root.style.setProperty('--sidebar-accent-foreground', `${h} 20% 30%`);
    } else {
      root.style.setProperty('--card', settings.card_color);
      root.style.setProperty('--popover', settings.card_color);
      root.style.setProperty('--card-foreground', '210 20% 92%');
      root.style.setProperty('--popover-foreground', '210 20% 92%');
      root.style.setProperty('--secondary', `${h} 16% 16%`);
      root.style.setProperty('--secondary-foreground', '210 20% 82%');
      root.style.setProperty('--muted', `${h} 14% 14%`);
      root.style.setProperty('--muted-foreground', `215 12% 50%`);
      root.style.setProperty('--border', `${h} 14% 18%`);
      root.style.setProperty('--input', `${h} 14% 18%`);
      root.style.setProperty('--sidebar-border', `${h} 14% 18%`);
      root.style.setProperty('--sidebar-accent', `${h} 16% 14%`);
      root.style.setProperty('--sidebar-foreground', '210 20% 82%');
      root.style.setProperty('--sidebar-accent-foreground', '210 20% 82%');
    }
  }

  if (settings.accent_color) {
    const { h, s } = parseHSL(settings.accent_color);
    if (light) {
      root.style.setProperty('--accent', `${h} ${s}% 90%`);
      root.style.setProperty('--accent-foreground', `${h} ${s}% 20%`);
    } else {
      root.style.setProperty('--accent', settings.accent_color);
      root.style.setProperty('--accent-foreground', `${h} 70% 85%`);
    }
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

  // Re-apply theme colors when light/dark class changes
  useEffect(() => {
    if (!settings.id) return;
    const observer = new MutationObserver(() => {
      applyThemeColors(settings);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [settings]);

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <PlatformContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
      {children}
    </PlatformContext.Provider>
  );
}
