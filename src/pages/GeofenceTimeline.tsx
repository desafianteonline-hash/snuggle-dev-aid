import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PlatformBrand from '@/components/PlatformBrand';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Calendar, Shield, LogIn, LogOut as LogOutIcon, MapPin, Loader2, Filter } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Geofence, GeofenceEvent } from '@/hooks/useGeofences';

interface EventWithDetails extends GeofenceEvent {
  patroller_name?: string;
  geofence_name?: string;
  geofence_color?: string;
}

const GeofenceTimeline = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [patrollers, setPatrollers] = useState<{ id: string; name: string }[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [filterPatroller, setFilterPatroller] = useState('all');
  const [filterGeofence, setFilterGeofence] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'enter' | 'exit'>('all');
  const [dateFrom, setDateFrom] = useState<Date>(startOfDay(subDays(new Date(), 7)));
  const [dateTo, setDateTo] = useState<Date>(endOfDay(new Date()));

  // Fetch patrollers and geofences for filters
  useEffect(() => {
    const fetchMeta = async () => {
      const [pRes, gRes] = await Promise.all([
        supabase.from('patrollers').select('id, name').order('name'),
        supabase.from('geofences').select('*').order('name'),
      ]);
      if (pRes.data) setPatrollers(pRes.data);
      if (gRes.data) setGeofences(gRes.data as Geofence[]);
    };
    fetchMeta();
  }, []);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('geofence_events')
      .select('*')
      .gte('recorded_at', startOfDay(dateFrom).toISOString())
      .lte('recorded_at', endOfDay(dateTo).toISOString())
      .order('recorded_at', { ascending: false })
      .limit(500);

    if (filterPatroller !== 'all') {
      query = query.eq('patroller_id', filterPatroller);
    }
    if (filterGeofence !== 'all') {
      query = query.eq('geofence_id', filterGeofence);
    }
    if (filterType !== 'all') {
      query = query.eq('event_type', filterType);
    }

    const { data } = await query;
    if (data) {
      const enriched: EventWithDetails[] = (data as GeofenceEvent[]).map(ev => ({
        ...ev,
        patroller_name: patrollers.find(p => p.id === ev.patroller_id)?.name || 'Desconhecido',
        geofence_name: geofences.find(g => g.id === ev.geofence_id)?.name || 'Removida',
        geofence_color: geofences.find(g => g.id === ev.geofence_id)?.color || '#6b7280',
      }));
      setEvents(enriched);
    }
    setLoading(false);
  }, [dateFrom, dateTo, filterPatroller, filterGeofence, filterType, patrollers, geofences]);

  useEffect(() => {
    if (patrollers.length > 0) fetchEvents();
  }, [fetchEvents, patrollers.length]);

  // Group events by date
  const grouped = useMemo(() => {
    const map = new Map<string, EventWithDetails[]>();
    for (const ev of events) {
      const dateKey = format(new Date(ev.recorded_at), 'yyyy-MM-dd');
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(ev);
    }
    return Array.from(map.entries()).map(([date, items]) => ({
      date,
      dateLabel: format(new Date(date), "EEEE, dd 'de' MMMM", { locale: ptBR }),
      items,
    }));
  }, [events]);

  const stats = useMemo(() => {
    const enters = events.filter(e => e.event_type === 'enter').length;
    const exits = events.filter(e => e.event_type === 'exit').length;
    const uniquePatrollers = new Set(events.map(e => e.patroller_id)).size;
    const uniqueGeofences = new Set(events.map(e => e.geofence_id)).size;
    return { enters, exits, total: events.length, uniquePatrollers, uniqueGeofences };
  }, [events]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card z-[1000]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PlatformBrand />
          <span className="text-xs text-muted-foreground hidden sm:block">/ Cercas Virtuais — Timeline</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Filters */}
      <div className="border-b border-border px-4 py-3 bg-card/50 grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end">
        <div className="col-span-2 sm:col-span-1 sm:min-w-[160px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Patrulheiro</label>
          <Select value={filterPatroller} onValueChange={setFilterPatroller}>
            <SelectTrigger className="bg-secondary border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {patrollers.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Cerca</label>
          <Select value={filterGeofence} onValueChange={setFilterGeofence}>
            <SelectTrigger className="bg-secondary border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {geofences.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[120px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Tipo</label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="bg-secondary border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="enter">Entradas</SelectItem>
              <SelectItem value="exit">Saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[130px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">De</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-secondary border-border text-sm">
                <Calendar className="mr-2 h-3.5 w-3.5" />
                {format(dateFrom, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(startOfDay(d))}
                disabled={(d) => d > new Date()}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-[130px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Até</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-secondary border-border text-sm">
                <Calendar className="mr-2 h-3.5 w-3.5" />
                {format(dateTo, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dateTo}
                onSelect={(d) => d && setDateTo(endOfDay(d))}
                disabled={(d) => d > new Date() || d < dateFrom}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-border grid grid-cols-3 sm:grid-cols-5 gap-2">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Entradas', value: stats.enters, color: 'text-primary' },
          { label: 'Saídas', value: stats.exits, color: 'text-destructive' },
          { label: 'Patrulheiros', value: stats.uniquePatrollers, color: 'text-foreground' },
          { label: 'Cercas', value: stats.uniqueGeofences, color: 'text-foreground' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-lg p-3 text-center"
          >
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {events.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum evento de cerca virtual encontrado</p>
              <p className="text-xs mt-1">Ajuste os filtros ou período</p>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {grouped.map(group => (
              <div key={group.date}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 capitalize">
                  {group.dateLabel}
                </h3>
                <div className="relative border-l-2 border-border ml-3 space-y-0">
                  {group.items.map((ev, i) => {
                    const isEnter = ev.event_type === 'enter';
                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="relative pl-6 pb-4"
                      >
                        {/* Dot on timeline */}
                        <div
                          className="absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2"
                          style={{
                            backgroundColor: isEnter ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
                            borderColor: 'hsl(var(--background))',
                          }}
                        />

                        <div className="bg-card border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isEnter ? (
                                <LogIn className="h-4 w-4 text-primary" />
                              ) : (
                                <LogOutIcon className="h-4 w-4 text-destructive" />
                              )}
                              <span className="text-sm font-semibold text-foreground">
                                {ev.patroller_name}
                              </span>
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                isEnter
                                  ? "bg-primary/15 text-primary"
                                  : "bg-destructive/15 text-destructive"
                              )}>
                                {isEnter ? 'Entrada' : 'Saída'}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(ev.recorded_at), 'HH:mm:ss')}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: ev.geofence_color }}
                            />
                            <span>{ev.geofence_name}</span>
                            <span className="opacity-50">•</span>
                            <MapPin className="h-3 w-3" />
                            <span>{ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GeofenceTimeline;
