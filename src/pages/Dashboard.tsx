import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePatrolLocations } from '@/hooks/usePatrolLocations';
import { useRouteHistory } from '@/hooks/useRouteHistory';
import PatrolMap from '@/components/PatrolMap';
import PatrollerSidebar from '@/components/PatrollerSidebar';
import { Shield, LogOut, Menu, X, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { patrollers, loading, realtimeConnected } = usePatrolLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card">
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-sm font-bold tracking-wider font-mono">
            PATROL<span className="text-primary">TRACK</span>
          </h1>
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
                className="absolute inset-y-0 left-0 z-20 w-72"
              >
                <PatrollerSidebar
                  patrollers={patrollers}
                  selectedId={selectedId}
                  onSelect={(id) => { setSelectedId(id); setSidebarOpen(false); }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="w-80 flex-shrink-0">
            <PatrollerSidebar
              patrollers={patrollers}
              selectedId={selectedId}
              onSelect={setSelectedId}
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
              onSelect={setSelectedId}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
