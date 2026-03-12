import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import { Shield, MapPin, Navigation, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const Patrol = () => {
  const { user, signOut } = useAuth();
  const [patrollerId, setPatrollerId] = useState<string | null>(null);
  const [patrollerName, setPatrollerName] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const geo = useGeolocation(consentGiven ? patrollerId : null);

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
      }
    };
    fetchPatroller();
  }, [user]);

  const handleConsent = () => {
    setConsentGiven(true);
    geo.startTracking();
  };

  if (!consentGiven) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center space-y-6"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Shield className="h-8 w-8 text-primary" />
          </div>

          <div>
            <h1 className="text-xl font-bold font-mono">PATROL<span className="text-primary">TRACK</span></h1>
            <p className="mt-1 text-sm text-muted-foreground">Olá, {patrollerName || 'Patrulheiro'}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 text-left space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-on-call))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Aviso de Privacidade</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Este aplicativo coleta dados de localização em tempo real para fins de monitoramento 
                  de segurança. Seus dados são utilizados exclusivamente para coordenação operacional 
                  e são armazenados de forma segura. Em conformidade com a LGPD (Lei Geral de Proteção de Dados).
                </p>
              </div>
            </div>

            <ul className="text-xs text-muted-foreground space-y-1 pl-7">
              <li>• Localização GPS será coletada durante o turno</li>
              <li>• Dados são usados apenas para operações da empresa</li>
              <li>• Você pode encerrar o rastreamento a qualquer momento</li>
            </ul>
          </div>

          <Button onClick={handleConsent} className="w-full font-semibold">
            <MapPin className="h-4 w-4 mr-2" />
            Aceitar e Iniciar Rastreamento
          </Button>

          <Button variant="ghost" onClick={signOut} className="w-full text-xs text-muted-foreground">
            Sair
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-sm w-full text-center space-y-6"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/5">
          <div className="relative">
            <div className="pulse-ring absolute inset-0 rounded-full border-2 border-primary" />
            <Navigation className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold">{patrollerName}</h2>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm">
            {geo.tracking ? (
              <>
                <Wifi className="h-4 w-4 text-[hsl(var(--status-online))]" />
                <span className="text-[hsl(var(--status-online))]">Rastreamento ativo</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <span className="text-destructive">Rastreamento parado</span>
              </>
            )}
          </div>
        </div>

        {geo.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {geo.error}
          </div>
        )}

        {geo.latitude && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Latitude</p>
                <p className="font-mono text-xs">{geo.latitude.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Longitude</p>
                <p className="font-mono text-xs">{geo.longitude?.toFixed(6)}</p>
              </div>
              {geo.speed != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Velocidade</p>
                  <p className="font-mono text-xs">{(geo.speed * 3.6).toFixed(0)} km/h</p>
                </div>
              )}
              {geo.accuracy != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Precisão</p>
                  <p className="font-mono text-xs">{geo.accuracy.toFixed(0)}m</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {geo.tracking ? (
            <Button variant="destructive" onClick={geo.stopTracking} className="w-full">
              Parar Rastreamento
            </Button>
          ) : (
            <Button onClick={geo.startTracking} className="w-full">
              Retomar Rastreamento
            </Button>
          )}

          <Button variant="ghost" onClick={signOut} className="w-full text-xs text-muted-foreground">
            Encerrar Turno
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Patrol;
