import { useState, useEffect, useCallback } from 'react';

type Mode = 'dark' | 'light';

function getInitialMode(): Mode {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('theme-mode') as Mode) || 'dark';
}

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
}

export function useThemeMode() {
  const [mode, setMode] = useState<Mode>(getInitialMode);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  // Apply on mount
  useEffect(() => {
    applyMode(getInitialMode());
  }, []);

  const toggle = useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  }, []);

  return { mode, toggle };
}
