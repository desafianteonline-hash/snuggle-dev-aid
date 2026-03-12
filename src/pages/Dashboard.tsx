import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePatrolLocations } from '@/hooks/usePatrolLocations';
import { useRouteHistory } from '@/hooks/useRouteHistory';
import { useOfflineAlerts } from '@/hooks/useOfflineAlerts';
import { useGeofences, type Geofence } from '@/hooks/useGeofences';
import { useGeofenceDetection } from '@/hooks/useGeofenceDetection';
import PatrolMap from '@/components/PatrolMap';
import PatrollerSidebar from '@/components/PatrollerSidebar';
import PlatformBrand from '@/components/PlatformBrand';
import GeofenceControls from '@/components/GeofenceControls';
import { Shield, LogOut, Menu, X, Wifi, WifiOff, RefreshCw, Share2, Route, Volume2, VolumeX, BarChart3, Monitor, Minimize, Clock } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { patrollers, loading, realtimeConnected } = usePatrolLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { route } = useRouteHistory(selectedId);
  const [alertSound, setAlertSound] = useState(() => localStorage.getItem('codseg-alert-sound') !== 'off');
  useOfflineAlerts(patrollers, alertSound);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [geofenceAddMode, setGeofenceAddMode] = useState(false);
  const [pendingGeofenceLocation, setPendingGeofenceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { geofences, addGeofence, removeGeofence } = useGeofences();

  useGeofenceDetection(patrollers, geofences, (event) => {
    toast({
      title: event.type === 'enter' ? '🟢 Entrada em cerca' : '🔴 Saída de cerca',
      description: `${event.patrollerName} ${event.type === 'enter' ? 'entrou em' : 'saiu de'} ${event.geofenceName}`,
    });
  });

  const handleGeofenceMapClick = useCallback((lat: number, lng: number) => {
    if (geofenceAddMode) {
      setPendingGeofenceLocation({ lat, lng });
    }
  }, [geofenceAddMode]);

  const handleGeofenceConfirm = useCallback(async (name: string, radius: number, color: string) => {
    if (!pendingGeofenceLocation || !user) return;
    await addGeofence({
      name,
      latitude: pendingGeofenceLocation.lat,
      longitude: pendingGeofenceLocation.lng,
      radius_meters: radius,
      color,
      created_by: user.id,
    });
    setPendingGeofenceLocation(null);
    setGeofenceAddMode(false);
    toast({ title: '✅ Cerca criada', description: `"${name}" adicionada com sucesso` });
  }, [pendingGeofenceLocation, user, addGeofence, toast]);

  const handleGeofenceDelete = useCallback(async (id: string) => {
    await removeGeofence(id);
    toast({ title: 'Cerca removida' });
  }, [removeGeofence, toast]);

  const handleGeofenceUpdate = useCallback(async (id: string, updates: Partial<Geofence>) => {
    await updateGeofence(id, updates);
    toast({ title: 'Cerca atualizada' });
  }, [updateGeofence, toast]);

  const toggleTvMode = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    setTvMode(prev => !prev);
  }, []);

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
      <header className={`flex items-center justify-between border-b border-border px-4 py-2 bg-card relative z-[1000] transition-all ${tvMode ? 'opacity-0 hover:opacity-100 h-0 hover:h-auto overflow-hidden hover:overflow-visible' : ''}`}>
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
          <PlatformBrand />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleForceRefresh}
            disabled={refreshing}
            title="Forçar atualização de localização"
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/history')}
            title="Histórico de rotas"
            className="gap-1.5"
          >
            <Route className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Histórico</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reports')}
            title="Relatórios"
            className="gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Relatórios</span>
          </Button>
          <GeofenceControls
            geofences={geofences}
            addMode={geofenceAddMode}
            onToggleAddMode={() => { setGeofenceAddMode(!geofenceAddMode); setPendingGeofenceLocation(null); }}
            pendingLocation={pendingGeofenceLocation}
            onConfirm={handleGeofenceConfirm}
            onCancel={() => setPendingGeofenceLocation(null)}
            onDelete={handleGeofenceDelete}
            onUpdate={handleGeofenceUpdate}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/geofence-timeline')}
            title="Timeline de cercas virtuais"
            className="gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Timeline</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/install')}
            title="Compartilhar app do patrulheiro"
            className="gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compartilhar App</span>
          </Button>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const next = !alertSound;
              setAlertSound(next);
              localStorage.setItem('codseg-alert-sound', next ? 'on' : 'off');
            }}
            title={alertSound ? 'Som de alerta: ATIVADO' : 'Som de alerta: DESATIVADO'}
          >
            {alertSound ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTvMode}
            title={tvMode ? 'Sair do modo TV' : 'Modo TV (fullscreen)'}
          >
            {tvMode ? <Minimize className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        {isMobile || tvMode ? (
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
              geofences={geofences}
              onGeofenceDelete={handleGeofenceDelete}
              geofenceAddMode={geofenceAddMode}
              onGeofenceMapClick={handleGeofenceMapClick}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
