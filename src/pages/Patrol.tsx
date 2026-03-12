import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { supabase } from '@/integrations/supabase/client';
import PlatformBrand from '@/components/PlatformBrand';
import { Shield, MapPin, Navigation, Wifi, WifiOff, AlertTriangle, Battery, Signal, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const CONSENT_KEY = 'patrol_consent_given';

const Patrol = () => {
  const { user, signOut } = useAuth();
  const { settings } = usePlatformSettings();
  const [patrollerId, setPatrollerId] = useState<string | null>(null);
  const [patrollerName, setPatrollerName] = useState('');
  const [consentGiven, setConsentGiven] = useState(() => localStorage.getItem(CONSENT_KEY) === 'true');
  const geo = useGeolocation(consentGiven ? patrollerId : null);

  // Fetch patroller and auto-start tracking
  useEffect(() => {
    if (!user) return;
    const fetchPatroller = async () => {
      const { data } = await supabase
        .from('patrollers')
        .select('id, name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setPatrollerId(data.id);
        setPatrollerName(data.name);
        await supabase.from('patrollers').update({ status: 'online' }).eq('id', data.id);
      }
    };
    fetchPatroller();
  }, [user]);

  // Listen for force-refresh broadcast from operator
  useEffect(() => {
    const channel = supabase.channel('force-location-update');
    channel
      .on('broadcast', { event: 'request_location' }, () => {
        console.log('[CODSEG GPS] Solicitação de atualização recebida do operador');
        // Force immediate location send
        if (geo.tracking && patrollerId) {
          geo.forceImmediateSend?.();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [geo.tracking, patrollerId]);

  // Auto-start tracking when consent is given and patrollerId is available
  useEffect(() => {
    if (consentGiven && patrollerId && !geo.tracking) {
      geo.startTracking();
    }
  }, [consentGiven, patrollerId]);

  // Set offline on unload via sendBeacon
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (patrollerId) {
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/patrollers?id=eq.${patrollerId}`;
          navigator.sendBeacon(
            url + `&apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            new Blob([JSON.stringify({ status: 'offline' })], { type: 'application/json' })
          );
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [patrollerId]);

  // Prevent accidental navigation/close
  useEffect(() => {
    if (!consentGiven) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'O rastreamento está ativo. Tem certeza que deseja sair?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [consentGiven]);

  const handleConsent = () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    setConsentGiven(true);
  };

  // Time since last sent
  const timeSinceLastSent = geo.lastSentAt
    ? Math.floor((Date.now() - new Date(geo.lastSentAt).getTime()) / 1000)
    : null;

  // LGPD consent screen (shown only once)
  if (!consentGiven) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center space-y-6"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <Shield className="h-8 w-8 text-primary" />
            )}
          </div>

          <div>
            <PlatformBrand size="md" className="justify-center" />
            <p className="mt-1 text-sm text-muted-foreground">Olá, {patrollerName || 'Patrulheiro'}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 text-left space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-on-call))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Aviso de Privacidade (LGPD)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Este aplicativo coleta dados de localização em tempo real para fins de monitoramento 
                  de segurança patrimonial. Seus dados são utilizados exclusivamente para coordenação 
                  operacional e são armazenados de forma segura, em conformidade com a LGPD 
                  (Lei Geral de Proteção de Dados - Lei nº 13.709/2018).
                </p>
              </div>
            </div>

            <ul className="text-xs text-muted-foreground space-y-1 pl-7">
              <li>• Localização GPS será coletada continuamente durante o turno</li>
              <li>• Dados são usados exclusivamente para operações da empresa</li>
              <li>• O rastreamento é obrigatório durante o horário de serviço</li>
              <li>• Seus dados são protegidos e acessíveis apenas aos operadores</li>
            </ul>
          </div>

          <Button onClick={handleConsent} className="w-full font-semibold">
            <MapPin className="h-4 w-4 mr-2" />
            Aceitar e Iniciar Serviço
          </Button>
        </motion.div>
      </div>
    );
  }

  // Main tracking screen - minimal, passive, no stop/logout controls
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 select-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-sm w-full text-center space-y-6"
      >
        {/* Tracking indicator */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/5 relative">
          <div className="pulse-ring absolute inset-0 rounded-full border-2 border-primary" />
          <Navigation className="h-10 w-10 text-primary" />
        </div>

        <div>
          <PlatformBrand size="sm" className="justify-center mb-2" />
          <h2 className="text-lg font-bold">{patrollerName}</h2>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm">
            {geo.tracking ? (
              <>
                <Wifi className="h-4 w-4 text-[hsl(var(--status-online))]" />
                <span className="text-[hsl(var(--status-online))] font-medium">Rastreamento Ativo</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <span className="text-destructive">Reconectando...</span>
              </>
            )}
          </div>
        </div>

        {geo.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs">{geo.error}</span>
          </div>
        )}

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <Signal className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Precisão</p>
            <p className="text-sm font-mono font-medium">
              {geo.accuracy ? `±${geo.accuracy.toFixed(0)}m` : '---'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <Navigation className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Velocidade</p>
            <p className="text-sm font-mono font-medium">
              {geo.speed != null
                ? `${(geo.speed * 3.6).toFixed(0)} km/h`
                : geo.motionSpeed != null
                  ? `~${geo.motionSpeed.toFixed(0)} km/h`
                  : '---'}
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              {geo.speed != null ? 'GPS' : geo.motionSpeed != null ? 'Sensor' : ''}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Último envio</p>
            <p className="text-sm font-mono font-medium">
              {timeSinceLastSent != null ? `${timeSinceLastSent}s` : '---'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <Battery className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Fila offline</p>
            <p className="text-sm font-mono font-medium">{geo.pendingQueue}</p>
          </div>
        </div>

        {/* Movement indicator */}
        {geo.isMoving && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-primary">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Em movimento
          </div>
        )}

        {/* Coordinates (small, informational) */}
        {geo.latitude && (
          <p className="text-xs text-muted-foreground font-mono">
            {geo.latitude.toFixed(6)}, {geo.longitude?.toFixed(6)}
          </p>
        )}

        {/* Subtle status bar */}
        <div className="text-xs text-muted-foreground/50 space-y-1">
          <p>Sistema de monitoramento ativo</p>
          <p>Não feche este aplicativo</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Patrol;
