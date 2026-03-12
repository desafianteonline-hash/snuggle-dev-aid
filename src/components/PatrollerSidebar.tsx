import { motion } from 'framer-motion';
import { MapPin, Clock, Gauge, Radio, User } from 'lucide-react';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';
import { cn } from '@/lib/utils';

const statusLabels: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  on_call: 'Em Ocorrência',
};

const statusClasses: Record<string, string> = {
  online: 'bg-[hsl(var(--status-online))]',
  offline: 'bg-[hsl(var(--status-offline))]',
  on_call: 'bg-[hsl(var(--status-on-call))]',
};

interface Props {
  patrollers: PatrollerWithLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const PatrollerSidebar = ({ patrollers, selectedId, onSelect }: Props) => {
  const online = patrollers.filter(p => p.status === 'online').length;
  const onCall = patrollers.filter(p => p.status === 'on_call').length;

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Patrulheiros</h2>
        <div className="mt-2 flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-online))]" />
            {online} online
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-on-call))]" />
            {onCall} em ocorrência
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {patrollers.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(p.id)}
            className={cn(
              "w-full text-left rounded-lg p-3 transition-colors",
              selectedId === p.id
                ? "bg-primary/10 border border-primary/30"
                : "hover:bg-secondary border border-transparent"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <span className={cn("h-2 w-2 rounded-full flex-shrink-0", statusClasses[p.status])} />
                </div>
                <p className="text-xs text-muted-foreground">{p.vehicle_plate || 'Sem placa'}</p>
              </div>
            </div>

            {p.latest_location && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(p.latest_location.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {p.latest_location.speed != null && (
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" />
                    {(p.latest_location.speed * 3.6).toFixed(0)} km/h
                  </span>
                )}
              </div>
            )}

            {!p.latest_location && p.status !== 'offline' && (
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Radio className="h-3 w-3" />
                Aguardando sinal GPS...
              </p>
            )}
          </motion.button>
        ))}

        {patrollers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhum patrulheiro cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatrollerSidebar;
