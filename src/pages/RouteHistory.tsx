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
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Calendar, Clock, Gauge, Navigation, Route, MapPin, Loader2, Download, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Patroller = Tables<'patrollers'>;
type LocationPoint = Tables<'patrol_locations'>;

function FitRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [positions, map]);
  return null;
}

function RouteStats({ points }: { points: LocationPoint[] }) {
  const stats = useMemo(() => {
    if (points.length < 2) return null;

    const startTime = new Date(points[0].recorded_at);
    const endTime = new Date(points[points.length - 1].recorded_at);
    const durationMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);

    let totalDistKm = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let speedCount = 0;

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const R = 6371;
      const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
      const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
      totalDistKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      if (p2.speed != null) {
        const kmh = p2.speed * 3.6;
        if (kmh > maxSpeed) maxSpeed = kmh;
        speedSum += kmh;
        speedCount++;
      }
    }

    return {
      startTime,
      endTime,
      duration: `${hours}h ${minutes}min`,
      distance: totalDistKm < 1 ? `${Math.round(totalDistKm * 1000)}m` : `${totalDistKm.toFixed(1)} km`,
      maxSpeed: maxSpeed.toFixed(0),
      avgSpeed: speedCount > 0 ? (speedSum / speedCount).toFixed(0) : '—',
      pointCount: points.length,
    };
  }, [points]);

  if (!stats) return null;

  const cards = [
    { icon: Clock, label: 'Duração', value: stats.duration },
    { icon: Route, label: 'Distância', value: stats.distance },
    { icon: Gauge, label: 'Vel. Máxima', value: `${stats.maxSpeed} km/h` },
    { icon: Gauge, label: 'Vel. Média', value: `${stats.avgSpeed} km/h` },
    { icon: MapPin, label: 'Pontos', value: stats.pointCount.toString() },
    { icon: Calendar, label: 'Início', value: format(stats.startTime, 'HH:mm', { locale: ptBR }) },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-card border border-border rounded-lg p-3 text-center"
        >
          <c.icon className="h-4 w-4 mx-auto text-primary mb-1" />
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="text-sm font-bold text-foreground">{c.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

const RouteHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patrollers, setPatrollers] = useState<Patroller[]>([]);
  const [selectedPatroller, setSelectedPatroller] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPatrollers, setLoadingPatrollers] = useState(true);

  // Fetch patrollers
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('patrollers').select('*').order('name');
      if (data) setPatrollers(data);
      setLoadingPatrollers(false);
    };
    fetch();
  }, []);

  // Fetch route for selected patroller + date
  const fetchRoute = useCallback(async () => {
    if (!selectedPatroller || !selectedDate) {
      setLocations([]);
      return;
    }
    setLoading(true);

    const startOfDay = new Date(`${selectedDate}T00:00:00`);
    const endOfDay = new Date(`${selectedDate}T23:59:59`);

    const { data } = await supabase
      .from('patrol_locations')
      .select('*')
      .eq('patroller_id', selectedPatroller)
      .gte('recorded_at', startOfDay.toISOString())
      .lte('recorded_at', endOfDay.toISOString())
      .order('recorded_at', { ascending: true })
      .limit(1000);

    setLocations(data || []);
    setLoading(false);
  }, [selectedPatroller, selectedDate]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  const positions = useMemo(
    () => locations.map(l => [l.latitude, l.longitude] as [number, number]),
    [locations]
  );

  const patrollerObj = patrollers.find(p => p.id === selectedPatroller);
  const patrollerName = patrollerObj?.name || '';

  // Generate last 30 days for date options
  const dateOptions = useMemo(() => {
    const dates: { value: string; label: string }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push({
        value: format(d, 'yyyy-MM-dd'),
        label: i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : format(d, "dd 'de' MMMM", { locale: ptBR }),
      });
    }
    return dates;
  }, []);

  // --- Export CSV ---
  const exportCSV = useCallback(() => {
    if (locations.length === 0) return;
    const header = 'Data/Hora,Latitude,Longitude,Precisão (m),Velocidade (km/h),Direção (°)\n';
    const rows = locations.map(l =>
      `${format(new Date(l.recorded_at), 'dd/MM/yyyy HH:mm:ss')},${l.latitude},${l.longitude},${l.accuracy ?? ''},${l.speed != null ? (l.speed * 3.6).toFixed(1) : ''},${l.heading?.toFixed(0) ?? ''}`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rota_${patrollerName}_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [locations, patrollerName, selectedDate]);

  // --- Export PDF (HTML-based print) ---
  const exportPDF = useCallback(() => {
    if (locations.length === 0) return;

    // Calculate stats for PDF
    let totalDistKm = 0;
    let maxSpeed = 0;
    for (let i = 1; i < locations.length; i++) {
      const p1 = locations[i - 1], p2 = locations[i];
      const R = 6371;
      const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
      const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      totalDistKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (p2.speed != null && p2.speed * 3.6 > maxSpeed) maxSpeed = p2.speed * 3.6;
    }

    const startTime = format(new Date(locations[0].recorded_at), 'HH:mm:ss');
    const endTime = format(new Date(locations[locations.length - 1].recorded_at), 'HH:mm:ss');
    const durationMs = new Date(locations[locations.length - 1].recorded_at).getTime() - new Date(locations[0].recorded_at).getTime();
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Relatório de Rota - ${patrollerName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
        h1 { font-size: 20px; border-bottom: 2px solid #22c55e; padding-bottom: 8px; }
        .info { display: flex; flex-wrap: wrap; gap: 20px; margin: 16px 0; }
        .info-card { background: #f5f5f5; border-radius: 8px; padding: 12px 16px; min-width: 120px; }
        .info-card .label { font-size: 11px; color: #888; text-transform: uppercase; }
        .info-card .value { font-size: 16px; font-weight: bold; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th { background: #22c55e; color: #fff; padding: 8px; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background: #fafafa; }
        .footer { margin-top: 30px; font-size: 10px; color: #aaa; text-align: center; }
      </style></head><body>
      <h1>📍 Relatório de Rota — CODSEG GPS</h1>
      <div class="info">
        <div class="info-card"><div class="label">Patrulheiro</div><div class="value">${patrollerName}</div></div>
        <div class="info-card"><div class="label">Placa</div><div class="value">${patrollerObj?.vehicle_plate || '—'}</div></div>
        <div class="info-card"><div class="label">Data</div><div class="value">${format(new Date(selectedDate), 'dd/MM/yyyy')}</div></div>
        <div class="info-card"><div class="label">Início</div><div class="value">${startTime}</div></div>
        <div class="info-card"><div class="label">Fim</div><div class="value">${endTime}</div></div>
        <div class="info-card"><div class="label">Duração</div><div class="value">${hours}h ${minutes}min</div></div>
        <div class="info-card"><div class="label">Distância</div><div class="value">${totalDistKm < 1 ? Math.round(totalDistKm * 1000) + 'm' : totalDistKm.toFixed(1) + ' km'}</div></div>
        <div class="info-card"><div class="label">Vel. Máxima</div><div class="value">${maxSpeed.toFixed(0)} km/h</div></div>
        <div class="info-card"><div class="label">Pontos</div><div class="value">${locations.length}</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Horário</th><th>Latitude</th><th>Longitude</th><th>Precisão</th><th>Velocidade</th><th>Direção</th></tr></thead>
        <tbody>
          ${locations.map((l, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${format(new Date(l.recorded_at), 'HH:mm:ss')}</td>
              <td>${l.latitude.toFixed(6)}</td>
              <td>${l.longitude.toFixed(6)}</td>
              <td>${l.accuracy != null ? l.accuracy.toFixed(0) + 'm' : '—'}</td>
              <td>${l.speed != null ? (l.speed * 3.6).toFixed(1) + ' km/h' : '—'}</td>
              <td>${l.heading != null ? l.heading.toFixed(0) + '°' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">Gerado por CODSEG GPS em ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }, [locations, patrollerName, patrollerObj, selectedDate]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-card z-[1000]">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PlatformBrand />
          <span className="text-xs text-muted-foreground hidden sm:block">/ Histórico de Rotas</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Filters */}
      <div className="border-b border-border px-4 py-3 bg-card/50 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Patrulheiro</label>
          <Select value={selectedPatroller} onValueChange={setSelectedPatroller}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder={loadingPatrollers ? 'Carregando...' : 'Selecione o patrulheiro'} />
            </SelectTrigger>
            <SelectContent>
              {patrollers.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.vehicle_plate ? `(${p.vehicle_plate})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px]">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Data</label>
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateOptions.map(d => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}

        {locations.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportCSV}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Stats */}
      {locations.length >= 2 && (
        <div className="px-4 py-3 border-b border-border">
          <RouteStats points={locations} />
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {!selectedPatroller ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Route className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione um patrulheiro para ver o histórico de rotas</p>
            </div>
          </div>
        ) : locations.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma rota encontrada para {patrollerName}</p>
              <p className="text-xs mt-1">na data selecionada</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={[-23.5505, -46.6333]}
            zoom={12}
            className="h-full w-full"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {positions.length >= 2 && (
              <>
                <FitRoute positions={positions} />
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color: 'hsl(142, 70%, 45%)',
                    weight: 4,
                    opacity: 0.85,
                  }}
                />

                {/* Start marker */}
                <CircleMarker
                  center={positions[0]}
                  radius={8}
                  pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold text-green-600">🟢 Início</p>
                      <p>{format(new Date(locations[0].recorded_at), 'HH:mm:ss', { locale: ptBR })}</p>
                    </div>
                  </Popup>
                </CircleMarker>

                {/* End marker */}
                <CircleMarker
                  center={positions[positions.length - 1]}
                  radius={8}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold text-red-600">🔴 Fim</p>
                      <p>{format(new Date(locations[locations.length - 1].recorded_at), 'HH:mm:ss', { locale: ptBR })}</p>
                    </div>
                  </Popup>
                </CircleMarker>

                {/* Intermediate points (sampled to avoid clutter) */}
                {locations
                  .filter((_, i) => i > 0 && i < locations.length - 1 && i % Math.max(1, Math.floor(locations.length / 20)) === 0)
                  .map((loc, i) => (
                    <CircleMarker
                      key={loc.id}
                      center={[loc.latitude, loc.longitude]}
                      radius={3}
                      pathOptions={{ color: 'hsl(142, 70%, 45%)', fillColor: 'hsl(142, 70%, 45%)', fillOpacity: 0.6, weight: 1 }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <p className="font-bold">{format(new Date(loc.recorded_at), 'HH:mm:ss')}</p>
                          {loc.speed != null && <p>{(loc.speed * 3.6).toFixed(0)} km/h</p>}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
              </>
            )}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default RouteHistory;
