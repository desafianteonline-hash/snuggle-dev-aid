import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePatrolLocations } from '@/hooks/usePatrolLocations';
import { useRouteHistory } from '@/hooks/useRouteHistory';
import PatrolMap from '@/components/PatrolMap';
import PatrollerSidebar from '@/components/PatrollerSidebar';
import PlatformBrand from '@/components/PlatformBrand';
import { Shield, LogOut, Menu, X, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { patrollers, loading, realtimeConnected } = usePatrolLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { route } = useRouteHistory(selectedId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const handleForceRefresh = useCallback(async () => {
    setRefreshing(true);
    const channel = supabase.channel('force-location-update');
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'request_location',
      payload: { requested_at: new Date().toISOString() },
    });
    supabase.removeChannel(channel);
    toast({
      title: 'Solicitação enviada',
      description: 'Aguardando atualização dos patrulheiros...',
    });
    setTimeout(() => setRefreshing(false), 3000);
  }, [toast]);

  const handleFlyTo = useCallback((lat: number, lng: number) => {
    // Force re-trigger by creating a new object each time
    setFlyTo({ lat, lng });
    setTimeout(() => setFlyTo(null), 2000);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    const p = patrollers.find(pt => pt.id === id);
    if (p?.latest_location) {
      handleFlyTo(p.latest_location.latitude, p.latest_location.longitude);
    }
  }, [patrollers, handleFlyTo]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card relative z-[1000]">
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
          <PlatformBrand />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs" title={realtimeConnected ? 'Conexão em tempo real ativa' : 'Usando polling como fallback'}>
            {realtimeConnected ? (
              <Wifi className="h-3.5 w-3.5 text-[hsl(var(--status-online))]" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-[hsl(var(--status-on-call))]" />
            )}
            <span className="hidden sm:inline text-muted-foreground">
              {realtimeConnected ? 'Tempo real' : 'Polling'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        {isMobile ? (
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25 }}
                className="absolute inset-y-0 left-0 z-[1000] w-72"
              >
                <PatrollerSidebar
                  patrollers={patrollers}
                  selectedId={selectedId}
                  onSelect={(id) => { handleSelect(id); setSidebarOpen(false); }}
                  onFlyTo={handleFlyTo}
                />
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="w-80 flex-shrink-0">
            <PatrollerSidebar
              patrollers={patrollers}
              selectedId={selectedId}
              onSelect={handleSelect}
              onFlyTo={handleFlyTo}
            />
          </div>
        )}

        {/* Map */}
        <div className="flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Shield className="h-8 w-8 animate-pulse text-primary" />
            </div>
          ) : (
            <PatrolMap
              patrollers={patrollers}
              selectedId={selectedId}
              onSelect={handleSelect}
              route={route}
              flyTo={flyTo}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
