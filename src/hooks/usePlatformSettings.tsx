import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformSettings {
  id: string;
  platform_name: string;
  platform_name_accent: string;
  page_title: string;
  logo_url: string | null;
  favicon_url: string | null;
}

const defaultSettings: PlatformSettings = {
  id: '',
  platform_name: 'PATROL',
  platform_name_accent: 'TRACK',
  page_title: 'PatrolTrack - Monitoramento',
  logo_url: null,
  favicon_url: null,
};

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
      setSettings(data as PlatformSettings);
      // Update document title
      document.title = data.page_title || 'PatrolTrack';
      // Update favicon
      if (data.favicon_url) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = data.favicon_url;
      }
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
