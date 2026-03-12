import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import PlatformBrand from '@/components/PlatformBrand';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Calendar, Loader2, Clock, Route, Gauge, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { format, startOfDay, endOfDay, eachDayOfInterval, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';

type Patroller = Tables<'patrollers'>;
type LocationPoint = Tables<'patrol_locations'>;

const COLORS = ['hsl(142,70%,45%)', 'hsl(200,70%,50%)', 'hsl(45,90%,50%)', 'hsl(0,70%,55%)', 'hsl(280,60%,55%)', 'hsl(30,80%,50%)'];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const Reports = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patrollers, setPatrollers] = useState<Patroller[]>([]);
  const [selectedPatroller, setSelectedPatroller] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return startOfDay(d);
  });
  const [dateTo, setDateTo] = useState<Date>(endOfDay(new Date()));
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('patrollers').select('*').order('name').then(({ data }) => {
      if (data) setPatrollers(data);
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('patrol_locations')
      .select('*')
      .gte('recorded_at', startOfDay(dateFrom).toISOString())
      .lte('recorded_at', endOfDay(dateTo).toISOString())
      .order('recorded_at', { ascending: true });

    if (selectedPatroller !== 'all') {
      query = query.eq('patroller_id', selectedPatroller);
    }

    const { data } = await query.limit(1000);
    setLocations(data || []);
    setLoading(false);
  }, [selectedPatroller, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Process data
  const stats = useMemo(() => {
    if (locations.length === 0) return null;

    const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
    const patrollerMap = new Map<string, string>();
    patrollers.forEach(p => patrollerMap.set(p.id, p.name));

    // Group by day
    const dailyData = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'dd/MM', { locale: ptBR });
      const dayLocs = locations.filter(l => l.recorded_at.startsWith(dayStr));

      // Calculate distance
      let distKm = 0;
      const byPatroller = new Map<string, LocationPoint[]>();
      dayLocs.forEach(l => {
        const arr = byPatroller.get(l.patroller_id) || [];
        arr.push(l);
        byPatroller.set(l.patroller_id, arr);
      });

      let totalMinutes = 0;
      byPatroller.forEach((locs) => {
        for (let i = 1; i < locs.length; i++) {
          distKm += haversine(locs[i - 1].latitude, locs[i - 1].longitude, locs[i].latitude, locs[i].longitude);
        }
        if (locs.length >= 2) {
          totalMinutes += differenceInMinutes(new Date(locs[locs.length - 1].recorded_at), new Date(locs[0].recorded_at));
        }
      });

      return {
        day: dayLabel,
        distancia: Math.round(distKm * 10) / 10,
        horas: Math.round(totalMinutes / 6) / 10, // hours with 1 decimal
        pontos: dayLocs.length,
        patrulheiros: byPatroller.size,
      };
    });

    // Total stats
    let totalDist = 0;
    let totalMinutes = 0;
    const patrollerIds = new Set<string>();
    const byPatrollerAll = new Map<string, LocationPoint[]>();
    locations.forEach(l => {
      patrollerIds.add(l.patroller_id);
      const arr = byPatrollerAll.get(l.patroller_id) || [];
      arr.push(l);
      byPatrollerAll.set(l.patroller_id, arr);
    });

    byPatrollerAll.forEach((locs) => {
      for (let i = 1; i < locs.length; i++) {
        totalDist += haversine(locs[i - 1].latitude, locs[i - 1].longitude, locs[i].latitude, locs[i].longitude);
      }
      if (locs.length >= 2) {
        totalMinutes += differenceInMinutes(new Date(locs[locs.length - 1].recorded_at), new Date(locs[0].recorded_at));
      }
    });

    // Per patroller breakdown
    const perPatroller = Array.from(byPatrollerAll.entries()).map(([id, locs]) => {
      let dist = 0;
      for (let i = 1; i < locs.length; i++) {
        dist += haversine(locs[i - 1].latitude, locs[i - 1].longitude, locs[i].latitude, locs[i].longitude);
      }
      const mins = locs.length >= 2 ? differenceInMinutes(new Date(locs[locs.length - 1].recorded_at), new Date(locs[0].recorded_at)) : 0;
      
      // Speed stats per patroller
      const patrollerSpeeds = locs.filter(l => l.speed != null).map(l => ({ speed: l.speed! * 3.6, recorded_at: l.recorded_at }));
      let maxSpeedRecord: { speed: number; recorded_at: string } | null = null;
      let avgSpeedValue = 0;
      if (patrollerSpeeds.length > 0) {
        maxSpeedRecord = patrollerSpeeds.reduce((max, cur) => cur.speed > max.speed ? cur : max);
        avgSpeedValue = Math.round(patrollerSpeeds.reduce((a, b) => a + b.speed, 0) / patrollerSpeeds.length);
      }

      const p = patrollers.find(pt => pt.id === id);
      return {
        id,
        name: patrollerMap.get(id) || id.slice(0, 8),
        plate: p?.vehicle_plate || '—',
        vehicleType: p?.vehicle_type || 'car',
        distancia: Math.round(dist * 10) / 10,
        horas: Math.round(mins / 6) / 10,
        maxSpeed: maxSpeedRecord ? Math.round(maxSpeedRecord.speed) : 0,
        maxSpeedAt: maxSpeedRecord?.recorded_at || null,
        avgSpeed: avgSpeedValue,
      };
    }).sort((a, b) => b.horas - a.horas);

    // Speed distribution
    const speeds = locations.filter(l => l.speed != null).map(l => l.speed! * 3.6);
    const speedRanges = [
      { name: '0-20', value: speeds.filter(s => s <= 20).length },
      { name: '20-40', value: speeds.filter(s => s > 20 && s <= 40).length },
      { name: '40-60', value: speeds.filter(s => s > 40 && s <= 60).length },
      { name: '60-80', value: speeds.filter(s => s > 60 && s <= 80).length },
      { name: '80+', value: speeds.filter(s => s > 80).length },
    ].filter(r => r.value > 0);

    // Top speed offenders (above 60 km/h)
    const speedAlerts = perPatroller
      .filter(p => p.maxSpeed > 60)
      .sort((a, b) => b.maxSpeed - a.maxSpeed);

    return {
      dailyData,
      totalDist: Math.round(totalDist * 10) / 10,
      totalHours: Math.round(totalMinutes / 6) / 10,
      totalPoints: locations.length,
      activePatrollers: patrollerIds.size,
      maxSpeed: speeds.length > 0 ? Math.round(Math.max(...speeds)) : 0,
      avgSpeed: speeds.length > 0 ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0,
      perPatroller,
      speedRanges,
      speedAlerts,
    };
  }, [locations, dateFrom, dateTo, patrollers]);

  const summaryCards = stats ? [
    { icon: Clock, label: 'Horas Patrulhadas', value: `${stats.totalHours}h`, color: 'text-primary' },
    { icon: Route, label: 'Distância Total', value: stats.totalDist < 1 ? `${Math.round(stats.totalDist * 1000)}m` : `${stats.totalDist} km`, color: 'text-primary' },
    { icon: Users, label: 'Patrulheiros Ativos', value: stats.activePatrollers.toString(), color: 'text-primary' },
    { icon: Gauge, label: 'Vel. Máxima', value: `${stats.maxSpeed} km/h`, color: 'text-destructive' },
    { icon: TrendingUp, label: 'Vel. Média', value: `${stats.avgSpeed} km/h`, color: 'text-primary' },
    { icon: Calendar, label: 'Registros GPS', value: stats.totalPoints.toLocaleString('pt-BR'), color: 'text-primary' },
  ] : [];

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card z-[1000]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PlatformBrand />
          <span className="text-xs text-muted-foreground hidden sm:block">/ Relatórios</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Filters */}
      <div className="border-b border-border px-4 py-3 bg-card/50 grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end">
        <div className="col-span-2 sm:flex-1 sm:min-w-[180px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Patrulheiro</label>
          <Select value={selectedPatroller} onValueChange={setSelectedPatroller}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os patrulheiros</SelectItem>
              {patrollers.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">De</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-secondary border-border text-sm">
                <Calendar className="mr-2 h-3.5 w-3.5" />
                {format(dateFrom, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(startOfDay(d))} disabled={(d) => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-[140px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Até</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-secondary border-border text-sm">
                <Calendar className="mr-2 h-3.5 w-3.5" />
                {format(dateTo, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(endOfDay(d))} disabled={(d) => d > new Date() || d < dateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!stats ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{loading ? 'Carregando dados...' : 'Nenhum dado encontrado para o período selecionado'}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {summaryCards.map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <c.icon className={cn("h-5 w-5 mb-2", c.color)} />
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-xl font-bold text-foreground">{c.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hours per day */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-bold mb-4 text-foreground">Horas Patrulhadas por Dia</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                      formatter={(v: number) => [`${v}h`, 'Horas']}
                    />
                    <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Distance per day */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-bold mb-4 text-foreground">Distância Percorrida por Dia (km)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={stats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                      formatter={(v: number) => [`${v} km`, 'Distância']}
                    />
                    <Area type="monotone" dataKey="distancia" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Per patroller */}
              {stats.perPatroller.length > 1 && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-bold mb-4 text-foreground">Desempenho por Patrulheiro</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.perPatroller} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="horas" fill="hsl(var(--primary))" name="Horas" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="distancia" fill="hsl(var(--accent))" name="km" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Speed distribution */}
              {stats.speedRanges.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-bold mb-4 text-foreground">Distribuição de Velocidade (km/h)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={stats.speedRanges} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {stats.speedRanges.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Patroller Table */}
            {stats.perPatroller.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-bold mb-4 text-foreground">Resumo por Patrulheiro</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground uppercase">Patrulheiro</th>
                        <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase">Horas</th>
                        <th className="text-right py-2 px-3 text-xs text-muted-foreground uppercase">Distância</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.perPatroller.map((p, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 px-3 font-medium text-foreground">{p.name}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{p.horas}h</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{p.distancia} km</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
