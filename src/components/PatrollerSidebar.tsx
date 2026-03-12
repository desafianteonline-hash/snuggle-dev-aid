import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Gauge, Radio, User, Car, Bike, Search, Filter, ChevronRight, Navigation, Phone, Eye, EyeOff, Pencil, Save, X, Plus, Trash2, ChevronDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';
import { useWatchPoints } from '@/hooks/useWatchPoints';
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
};

const statusClasses: Record<string, string> = {
  online: 'bg-[hsl(var(--status-online))]',
  offline: 'bg-[hsl(var(--status-offline))]',
};

const vehicleIcons: Record<string, typeof Car> = {
  car: Car,
  motorcycle: Bike,
};

type StatusFilter = 'all' | 'online' | 'offline';

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

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

const PatrollerSidebar = ({ patrollers, selectedId, onSelect, onFlyTo }: Props) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVehicleType, setEditVehicleType] = useState<string>('car');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Watch points
  const { points: watchPoints, add: addWatchPoint, remove: removeWatchPoint } = useWatchPoints();
  const [showWatchPoints, setShowWatchPoints] = useState(true);
  const [addingPoint, setAddingPoint] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [newPointLat, setNewPointLat] = useState('');
  const [newPointLng, setNewPointLng] = useState('');
  const [newPointCep, setNewPointCep] = useState('');
  const [newPointNumber, setNewPointNumber] = useState('');
  const [cepAddress, setCepAddress] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [savingPoint, setSavingPoint] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [addMode, setAddMode] = useState<'cep' | 'coords'>('cep');

  const online = patrollers.filter(p => p.status === 'online').length;
  const offline = patrollers.filter(p => p.status === 'offline').length;

  const filtered = patrollers
    .filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.vehicle_plate || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const order: Record<string, number> = { online: 0, offline: 1 };
      return (order[a.status] ?? 2) - (order[b.status] ?? 2);
    });

  // Calculate nearest patroller for each watch point
  const onlinePatrollers = useMemo(() =>
    patrollers.filter(p => p.latest_location && p.status !== 'offline'),
    [patrollers]
  );

  const watchPointsWithNearest = useMemo(() =>
    watchPoints.map(wp => {
      const nearest = onlinePatrollers
        .map(p => ({
          ...p,
          distance: haversineDistance(wp.latitude, wp.longitude, p.latest_location!.latitude, p.latest_location!.longitude),
        }))
        .sort((a, b) => a.distance - b.distance)[0] || null;
      return { ...wp, nearest };
    }),
    [watchPoints, onlinePatrollers]
  );

  const cepDataRef = useRef<any>(null);

  const handleCepLookup = async (cep: string) => {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) return;
    setLoadingCep(true);
    setCepAddress('');
    setNewPointLat('');
    setNewPointLng('');
    try {
      const viaRes = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const viaData = await viaRes.json();
      if (viaData.erro) {
        toast({ title: 'CEP não encontrado', variant: 'destructive' });
        setLoadingCep(false);
        return;
      }
      cepDataRef.current = viaData;
      const addr = `${viaData.logradouro || ''}, ${viaData.bairro || ''}, ${viaData.localidade} - ${viaData.uf}`;
      setCepAddress(addr);
      if (!newPointName.trim()) {
        setNewPointName(`${viaData.bairro || viaData.localidade}`);
      }
      // Geocode with number if available
      await geocodeAddress(viaData, newPointNumber);
    } catch {
      toast({ title: 'Erro ao buscar CEP', variant: 'destructive' });
    }
    setLoadingCep(false);
  };

  const geocodeAddress = async (viaData: any, number: string): Promise<{ lat: string; lng: string } | null> => {
    if (!viaData) return null;
    const street = viaData.logradouro || '';
    const city = viaData.localidade || '';
    const state = viaData.uf || '';
    const neighborhood = viaData.bairro || '';

    // Try multiple query strategies (most specific → least specific)
    const queries = [
      // 1. Structured query with street + number
      number
        ? `street=${encodeURIComponent(`${street}, ${number}`)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=Brazil&format=json&limit=1`
        : null,
      // 2. Structured query without number
      `street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=Brazil&format=json&limit=1`,
      // 3. Free-form: street + neighborhood + city
      `q=${encodeURIComponent(`${street}, ${neighborhood}, ${city}, ${state}, Brazil`)}&format=json&limit=1`,
      // 4. Free-form: just neighborhood + city (fallback)
      `q=${encodeURIComponent(`${neighborhood}, ${city}, ${state}, Brazil`)}&format=json&limit=1`,
      // 5. Free-form: just city (last resort)
      `q=${encodeURIComponent(`${city}, ${state}, Brazil`)}&format=json&limit=1`,
    ].filter(Boolean) as string[];

    for (const qs of queries) {
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`);
        const geoData = await geoRes.json();

        if (geoData.length > 0) {
          const lat = geoData[0].lat as string;
          const lng = geoData[0].lon as string;
          setNewPointLat(lat);
          setNewPointLng(lng);
          return { lat, lng };
        }
      } catch {
        // Try next query
      }
    }

    return null;
  };

  const handleNumberBlur = () => {
    if (cepDataRef.current && newPointNumber.trim()) {
      geocodeAddress(cepDataRef.current, newPointNumber);
    }
  };

  const handleAddPoint = async () => {
    setSaveStatus(null);

    if (!newPointName.trim()) {
      setSaveStatus({ type: 'error', message: 'Informe o nome do ponto' });
      return;
    }

    let lat = parseFloat(newPointLat);
    let lng = parseFloat(newPointLng);

    if (addMode === 'cep') {
      const cleanedCep = newPointCep.replace(/\D/g, '');
      if (cleanedCep.length !== 8 || !newPointNumber.trim()) {
        setSaveStatus({ type: 'error', message: 'Preencha CEP + número do endereço' });
        return;
      }

      if (isNaN(lat) || isNaN(lng)) {
        setSavingPoint(true);
        const coords = await geocodeAddress(cepDataRef.current, newPointNumber.trim());

        if (!coords) {
          setSaveStatus({ type: 'error', message: 'Não foi possível obter coordenadas para esse endereço' });
          setSavingPoint(false);
          return;
        }

        lat = parseFloat(coords.lat);
        lng = parseFloat(coords.lng);
      }
    }

    if (isNaN(lat) || isNaN(lng)) {
      setSaveStatus({ type: 'error', message: 'Coordenadas inválidas. Preencha corretamente.' });
      return;
    }

    setSavingPoint(true);
    const { error } = await addWatchPoint(newPointName.trim(), lat, lng);
    setSavingPoint(false);

    if (error) {
      setSaveStatus({ type: 'error', message: error });
    } else {
      setSaveStatus({ type: 'success', message: 'Ponto cadastrado com sucesso!' });
      setTimeout(() => {
        setAddingPoint(false);
        setNewPointName('');
        setNewPointLat('');
        setNewPointLng('');
        setNewPointCep('');
        setNewPointNumber('');
        setCepAddress('');
        setSaveStatus(null);
      }, 1500);
    }
  };

  const handleRemovePoint = async (id: string) => {
    await removeWatchPoint(id);
    toast({ title: 'Ponto removido' });
  };

  const startEditing = (p: PatrollerWithLocation) => {
    setEditingId(p.id);
    setEditVehicleType(p.vehicle_type || 'car');
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSave = async (patrollerId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('patrollers')
      .update({ vehicle_type: editVehicleType })
      .eq('id', patrollerId);

    if (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } else {
      toast({ title: 'Alterações salvas com sucesso!' });
      setEditingId(null);
    }
    setSaving(false);
  };

  const handleLocate = (p: PatrollerWithLocation) => {
    if (p.latest_location && onFlyTo) {
      onFlyTo(p.latest_location.latitude, p.latest_location.longitude);
    }
    onSelect(p.id);
  };

  const [activeTab, setActiveTab] = useState<'patrollers' | 'nearby'>('patrollers');

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header with stats */}
      <div className="p-4 border-b border-border">
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-online))]" />
            {online} online
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-offline))]" />
            {offline} offline
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
            activeTab === 'patrollers'
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
          onClick={() => setActiveTab('patrollers')}
        >
          <User className="h-3.5 w-3.5" />
          Patrulheiros
        </button>
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
            activeTab === 'nearby'
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
          onClick={() => setActiveTab('nearby')}
        >
          <MapPin className="h-3.5 w-3.5" />
          Mais Próximo
          {watchPoints.length > 0 && (
            <span className="bg-primary/20 text-primary rounded-full px-1.5 text-[10px]">{watchPoints.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'patrollers' ? (
        <>
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
            <div className="mt-2 flex gap-2">
              <button onClick={() => setStatusFilter(statusFilter === 'online' ? 'all' : 'online')} className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors", statusFilter === 'online' && 'bg-primary/20')}>
                Online
              </button>
              <button onClick={() => setStatusFilter(statusFilter === 'offline' ? 'all' : 'offline')} className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors", statusFilter === 'offline' && 'bg-primary/20')}>
                Offline
              </button>
            </div>
          </div>

          {/* Patroller List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((p, i) => {
          const VehicleIcon = vehicleIcons[p.vehicle_type || 'car'] || Car;
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
                  {/* Header with edit toggle */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Detalhes</p>
                    {editingId !== p.id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => { e.stopPropagation(); startEditing(p); }}
                        title="Editar"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                        title="Cancelar"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>

                  {/* Vehicle type */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Tipo de veículo</p>
                    {editingId === p.id ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={editVehicleType === 'car' ? 'default' : 'outline'}
                          className="h-7 text-xs gap-1.5"
                          onClick={(e) => { e.stopPropagation(); setEditVehicleType('car'); }}
                        >
                          <Car className="h-3.5 w-3.5" /> Carro
                        </Button>
                        <Button
                          size="sm"
                          variant={editVehicleType === 'motorcycle' ? 'default' : 'outline'}
                          className="h-7 text-xs gap-1.5"
                          onClick={(e) => { e.stopPropagation(); setEditVehicleType('motorcycle'); }}
                        >
                          <Bike className="h-3.5 w-3.5" /> Moto
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs">
                        {(p.vehicle_type || 'car') === 'motorcycle' ? (
                          <><Bike className="h-3.5 w-3.5 text-primary" /> Moto</>
                        ) : (
                          <><Car className="h-3.5 w-3.5 text-primary" /> Carro</>
                        )}
                      </div>
                    )}
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
                    {editingId === p.id && (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1.5 flex-1"
                        disabled={saving}
                        onClick={(e) => { e.stopPropagation(); handleSave(p.id); }}
                      >
                        <Save className="h-3 w-3" /> {saving ? 'Salvando...' : 'Salvar'}
                      </Button>
                    )}
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
        </>
      ) : (
        /* ===== NEARBY TAB ===== */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {watchPointsWithNearest.length > 0 ? (
            watchPointsWithNearest.map(wp => (
              <div
                key={wp.id}
                className="rounded-xl border border-border bg-secondary/30 p-3 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{wp.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {wp.latitude.toFixed(4)}, {wp.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePoint(wp.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>

                {wp.nearest ? (
                  <div
                    className="flex items-center gap-2 cursor-pointer rounded-lg border border-primary/20 bg-primary/5 p-2 hover:bg-primary/10 transition-colors"
                    onClick={() => {
                      onSelect(wp.nearest!.id);
                      if (wp.nearest!.latest_location && onFlyTo) {
                        onFlyTo(wp.nearest!.latest_location.latitude, wp.nearest!.latest_location.longitude);
                      }
                    }}
                  >
                    <Navigation className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{wp.nearest.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistance(wp.nearest.distance)} • {wp.nearest.vehicle_plate || 'Sem placa'}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/50 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Nenhum patrulheiro online</p>
                  </div>
                )}

                {/* Show button to fly to the watch point itself */}
                <button
                  className="mt-1.5 w-full text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
                  onClick={() => onFlyTo?.(wp.latitude, wp.longitude)}
                >
                  <Eye className="h-3 w-3" /> Ver no mapa
                </button>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MapPin className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm text-center">Nenhum ponto cadastrado</p>
              <p className="text-xs text-center mt-1">Adicione locais para ver o patrulheiro mais próximo</p>
            </div>
          )}

          {/* Add new point */}
          {addingPoint ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-bold text-primary">Novo Ponto de Referência</p>

              {/* Mode toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  className={cn("flex-1 text-[10px] py-1.5 font-medium transition-colors", addMode === 'cep' ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}
                  onClick={() => setAddMode('cep')}
                >
                  Buscar por CEP
                </button>
                <button
                  className={cn("flex-1 text-[10px] py-1.5 font-medium transition-colors", addMode === 'coords' ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}
                  onClick={() => setAddMode('coords')}
                >
                  Coordenadas
                </button>
              </div>

              {addMode === 'cep' ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="CEP (ex: 01001000)"
                      value={newPointCep}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setNewPointCep(v);
                        if (v.length === 8) handleCepLookup(v);
                      }}
                      className="h-8 text-xs flex-1"
                      maxLength={9}
                    />
                    <Input
                      placeholder="Nº"
                      value={newPointNumber}
                      onChange={e => setNewPointNumber(e.target.value.replace(/\D/g, ''))}
                      onBlur={handleNumberBlur}
                      className="h-8 text-xs w-20"
                    />
                    {loadingCep && <div className="flex items-center"><span className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                  </div>
                  {cepAddress && (
                    <div className="rounded-lg bg-secondary/50 p-2 text-[10px] text-muted-foreground">
                      📍 {cepAddress}{newPointNumber ? `, ${newPointNumber}` : ''}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="any"
                    placeholder="Latitude"
                    value={newPointLat}
                    onChange={e => setNewPointLat(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    step="any"
                    placeholder="Longitude"
                    value={newPointLng}
                    onChange={e => setNewPointLng(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <Input
                placeholder="Nome (ex: Base, Centro da Cidade)"
                value={newPointName}
                onChange={e => setNewPointName(e.target.value)}
                className="h-8 text-xs"
              />

              {/* Show resolved coords */}
              {newPointLat && newPointLng && (
                <p className="text-[10px] text-muted-foreground font-mono">
                  Coords: {parseFloat(newPointLat).toFixed(5)}, {parseFloat(newPointLng).toFixed(5)}
                </p>
              )}

              {/* Status feedback */}
              {saveStatus && (
                <div className={cn(
                  "rounded-lg p-2 text-[11px] flex items-center gap-1.5 font-medium",
                  saveStatus.type === 'success' ? "bg-[hsl(var(--status-online))]/15 text-[hsl(var(--status-online))]" : "bg-destructive/15 text-destructive"
                )}>
                  {saveStatus.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />}
                  {saveStatus.message}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleAddPoint} disabled={savingPoint || loadingCep}>
                  {savingPoint ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Salvando...</>
                  ) : (
                    <><Save className="h-3 w-3 mr-1" /> Salvar</>
                  )}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingPoint(false); setNewPointCep(''); setCepAddress(''); setSaveStatus(null); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-9 text-xs gap-1.5"
              onClick={() => setAddingPoint(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar ponto de referência
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default PatrollerSidebar;
