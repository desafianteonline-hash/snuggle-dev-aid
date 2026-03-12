import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';
import type { LocationPoint } from '@/hooks/useRouteHistory';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const statusColors: Record<string, string> = {
  online: '#22c55e',
  offline: '#6b7280',
  on_call: '#f59e0b',
};

function createPatrollerIcon(status: string, isSelected: boolean) {
  const color = statusColors[status] || '#6b7280';
  const size = isSelected ? 22 : 16;
  const ringSize = isSelected ? 40 : 32;
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div class="pulse-ring" style="position:absolute;width:${ringSize}px;height:${ringSize}px;border-radius:50%;border:2px solid ${color};opacity:${isSelected ? 0.8 : 0.5};"></div>
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid hsl(220,18%,10%);box-shadow:0 0 ${isSelected ? 14 : 8}px ${color}${isSelected ? 'cc' : '80'};"></div>
      </div>
    `,
    iconSize: [ringSize, ringSize],
    iconAnchor: [ringSize / 2, ringSize / 2],
  });
}

function FitBounds({ patrollers }: { patrollers: PatrollerWithLocation[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    const withLoc = patrollers.filter(p => p.latest_location);
    if (withLoc.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(
        withLoc.map(p => [p.latest_location!.latitude, p.latest_location!.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
      fitted.current = true;
    }
  }, [patrollers, map]);

  return null;
}

function FitRoute({ route }: { route: LocationPoint[] }) {
  const map = useMap();
  const lastRouteId = useRef<string | null>(null);

  useEffect(() => {
    if (route.length < 2) return;
    const id = route[0].patroller_id;
    if (lastRouteId.current === id) return;
    lastRouteId.current = id;

    const bounds = L.latLngBounds(
      route.map(l => [l.latitude, l.longitude] as [number, number])
    );
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [route, map]);

  return null;
}

interface PatrolMapProps {
  patrollers: PatrollerWithLocation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  route?: LocationPoint[];
}

const PatrolMap = ({ patrollers, selectedId, onSelect, route = [] }: PatrolMapProps) => {
  const defaultCenter: [number, number] = [-23.5505, -46.6333];

  const routePositions = route.map(l => [l.latitude, l.longitude] as [number, number]);
  const selectedPatroller = patrollers.find(p => p.id === selectedId);
  const routeColor = selectedPatroller ? (statusColors[selectedPatroller.status] || '#6b7280') : '#3b82f6';

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className="h-full w-full rounded-xl"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds patrollers={patrollers} />

      {/* Route polyline */}
      {routePositions.length >= 2 && (
        <>
          <FitRoute route={route} />
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: routeColor,
              weight: 3,
              opacity: 0.7,
              dashArray: '8 4',
            }}
          />
          {/* Start marker */}
          <CircleMarker
            center={routePositions[0]}
            radius={5}
            pathOptions={{ color: routeColor, fillColor: routeColor, fillOpacity: 1 }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold">Início da rota</p>
                <p>{new Date(route[0].recorded_at).toLocaleTimeString('pt-BR')}</p>
              </div>
            </Popup>
          </CircleMarker>
        </>
      )}

      {/* Patroller markers */}
      {patrollers.map(p => {
        if (!p.latest_location) return null;
        const isSelected = p.id === selectedId;
        return (
          <Marker
            key={p.id}
            position={[p.latest_location.latitude, p.latest_location.longitude]}
            icon={createPatrollerIcon(p.status, isSelected)}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          >
            <Popup className="dark-popup">
              <div className="text-sm">
                <p className="font-bold">{p.name}</p>
                <p className="text-xs opacity-70">{p.vehicle_plate || 'Sem placa'}</p>
                <p className="text-xs opacity-70">
                  {new Date(p.latest_location.recorded_at).toLocaleTimeString('pt-BR')}
                </p>
                {p.latest_location.speed != null && (
                  <p className="text-xs opacity-70">
                    {(p.latest_location.speed * 3.6).toFixed(0)} km/h
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default PatrolMap;
