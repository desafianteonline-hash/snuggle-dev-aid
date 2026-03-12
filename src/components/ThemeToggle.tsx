import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeMode } from '@/hooks/useThemeMode';

export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={mode === 'dark' ? 'Modo claro' : 'Modo escuro'}
    >
      {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
