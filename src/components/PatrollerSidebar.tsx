import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, Gauge, Radio, User, Car, Bike, Search, Filter, ChevronRight, Navigation, Phone, Eye, EyeOff } from 'lucide-react';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

const vehicleIcons: Record<string, typeof Car> = {
  car: Car,
  motorcycle: Bike,
};

type StatusFilter = 'all' | 'online' | 'offline' | 'on_call';

interface Props {
  patrollers: PatrollerWithLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFlyTo?: (lat: number, lng: number) => void;
}

function timeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

const PatrollerSidebar = ({ patrollers, selectedId, onSelect, onFlyTo }: Props) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const online = patrollers.filter(p => p.status === 'online').length;
  const onCall = patrollers.filter(p => p.status === 'on_call').length;
  const offline = patrollers.filter(p => p.status === 'offline').length;

  const filtered = patrollers
    .filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.vehicle_plate || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const order: Record<string, number> = { on_call: 0, online: 1, offline: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

  const handleVehicleTypeChange = async (patrollerId: string, type: string) => {
    const { error } = await supabase
      .from('patrollers')
      .update({ vehicle_type: type } as any)
      .eq('id', patrollerId);

    if (error) {
      toast({ title: 'Erro ao atualizar veículo', variant: 'destructive' });
    } else {
      toast({ title: `Veículo atualizado para ${type === 'car' ? 'Carro' : 'Moto'}` });
    }
  };

  const handleLocate = (p: PatrollerWithLocation) => {
    if (p.latest_location && onFlyTo) {
      onFlyTo(p.latest_location.latitude, p.latest_location.longitude);
    }
    onSelect(p.id);
  };

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Patrulheiros</h2>
        <div className="mt-2 flex gap-3 text-xs">
          <button onClick={() => setStatusFilter(statusFilter === 'online' ? 'all' : 'online')} className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors", statusFilter === 'online' && 'bg-primary/20')}>
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-online))]" />
            {online} online
          </button>
          <button onClick={() => setStatusFilter(statusFilter === 'on_call' ? 'all' : 'on_call')} className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors", statusFilter === 'on_call' && 'bg-primary/20')}>
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-on-call))]" />
            {onCall} em ocorrência
          </button>
          <button onClick={() => setStatusFilter(statusFilter === 'offline' ? 'all' : 'offline')} className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors", statusFilter === 'offline' && 'bg-primary/20')}>
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-offline))]" />
            {offline} offline
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou placa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((p, i) => {
          const VehicleIcon = vehicleIcons[(p as any).vehicle_type || 'car'] || Car;
          const isExpanded = expandedId === p.id;
          const isSelected = selectedId === p.id;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <button
                onClick={() => handleLocate(p)}
                className={cn(
                  "w-full text-left rounded-lg p-3 transition-colors",
                  isSelected
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-secondary border border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary relative">
                    <VehicleIcon className="h-4 w-4 text-muted-foreground" />
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card", statusClasses[p.status])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{p.vehicle_plate || 'Sem placa'}</span>
                      <span>•</span>
                      <span>{statusLabels[p.status]}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(isExpanded ? null : p.id);
                    }}
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
                  </Button>
                </div>

                {/* Quick info */}
                {p.latest_location && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeSince(p.latest_location.recorded_at)}
                    </span>
                    {p.latest_location.speed != null && (
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {(p.latest_location.speed * 3.6).toFixed(0)} km/h
                      </span>
                    )}
                    {p.latest_location.heading != null && (
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" style={{ transform: `rotate(${p.latest_location.heading}deg)` }} />
                        {p.latest_location.heading.toFixed(0)}°
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
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mx-3 mb-2 p-3 rounded-lg bg-secondary/50 space-y-3"
                >
                  {/* Vehicle type selector */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Tipo de veículo</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={(p as any).vehicle_type === 'car' || !(p as any).vehicle_type ? 'default' : 'outline'}
                        className="h-7 text-xs gap-1.5"
                        onClick={(e) => { e.stopPropagation(); handleVehicleTypeChange(p.id, 'car'); }}
                      >
                        <Car className="h-3.5 w-3.5" /> Carro
                      </Button>
                      <Button
                        size="sm"
                        variant={(p as any).vehicle_type === 'motorcycle' ? 'default' : 'outline'}
                        className="h-7 text-xs gap-1.5"
                        onClick={(e) => { e.stopPropagation(); handleVehicleTypeChange(p.id, 'motorcycle'); }}
                      >
                        <Bike className="h-3.5 w-3.5" /> Moto
                      </Button>
                    </div>
                  </div>

                  {/* Contact info */}
                  {p.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${p.phone}`} className="hover:text-primary transition-colors">{p.phone}</a>
                    </div>
                  )}

                  {/* Coordinates */}
                  {p.latest_location && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.latest_location.latitude.toFixed(5)}, {p.latest_location.longitude.toFixed(5)}
                      </p>
                      {p.latest_location.accuracy != null && (
                        <p className="text-xs opacity-70">Precisão: ±{p.latest_location.accuracy.toFixed(0)}m</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 flex-1"
                      disabled={!p.latest_location}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (p.latest_location) {
                          window.open(`https://www.google.com/maps?q=${p.latest_location.latitude},${p.latest_location.longitude}`, '_blank');
                        }
                      }}
                    >
                      <Navigation className="h-3 w-3" /> Google Maps
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">{search ? 'Nenhum resultado encontrado' : 'Nenhum patrulheiro cadastrado'}</p>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="border-t border-border p-3 text-xs text-muted-foreground flex justify-between">
        <span>{filtered.length} de {patrollers.length} patrulheiros</span>
        {statusFilter !== 'all' && (
          <button onClick={() => setStatusFilter('all')} className="text-primary hover:underline">Limpar filtro</button>
        )}
      </div>
    </div>
  );
};

export default PatrollerSidebar;
