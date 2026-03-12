import { useEffect, useRef, useCallback } from 'react';
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

const carSvg = (color: string, size: number) => `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="7" width="18" height="10" rx="3" fill="${color}" opacity="0.9"/>
  <rect x="5" y="4" width="14" height="6" rx="2" fill="${color}"/>
  <circle cx="7.5" cy="17" r="2" fill="hsl(220,18%,10%)" stroke="${color}" stroke-width="1"/>
  <circle cx="16.5" cy="17" r="2" fill="hsl(220,18%,10%)" stroke="${color}" stroke-width="1"/>
  <rect x="6" y="8" width="4" height="3" rx="0.5" fill="hsl(220,18%,10%)" opacity="0.5"/>
  <rect x="14" y="8" width="4" height="3" rx="0.5" fill="hsl(220,18%,10%)" opacity="0.5"/>
</svg>`;

const motorcycleSvg = (color: string, size: number) => `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="5" cy="16" r="3" fill="hsl(220,18%,10%)" stroke="${color}" stroke-width="1.5"/>
  <circle cx="19" cy="16" r="3" fill="hsl(220,18%,10%)" stroke="${color}" stroke-width="1.5"/>
  <path d="M5 16L10 8L14 8L19 16" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <rect x="9" y="6" width="6" height="3" rx="1" fill="${color}"/>
  <circle cx="12" cy="7" r="1.5" fill="hsl(220,18%,10%)"/>
</svg>`;

function createPatrollerIcon(status: string, isSelected: boolean, vehicleType: string = 'car', name: string = '', plate: string = '') {
  const color = statusColors[status] || '#6b7280';
  const size = isSelected ? 36 : 28;
  const outerSize = size + 16;
  const labelWidth = Math.max(80, name.length * 7 + 16);

  const svg = vehicleType === 'motorcycle' ? motorcycleSvg(color, size) : carSvg(color, size);

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div class="pulse-ring" style="position:absolute;width:${outerSize}px;height:${outerSize}px;border-radius:50%;border:2px solid ${color};opacity:${isSelected ? 0.8 : 0.4};"></div>
          <div style="filter:drop-shadow(0 0 ${isSelected ? 8 : 4}px ${color}80);">
            ${svg}
          </div>
        </div>
        <div style="margin-top:2px;background:rgba(0,0,0,0.75);border:1px solid ${color};border-radius:4px;padding:1px 6px;white-space:nowrap;text-align:center;min-width:${labelWidth}px;">
          <div style="font-size:10px;font-weight:700;color:#fff;line-height:1.3;">${name}</div>
          ${plate ? `<div style="font-size:8px;color:rgba(255,255,255,0.7);line-height:1.2;">${plate}</div>` : ''}
        </div>
      </div>
    `,
    iconSize: [labelWidth, outerSize + 30],
    iconAnchor: [labelWidth / 2, outerSize / 2],
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

function FlyToHandler({ flyTo }: { flyTo: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], 17, { duration: 1.2 });
  }, [flyTo, map]);

  return null;
}

interface PatrolMapProps {
  patrollers: PatrollerWithLocation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  route?: LocationPoint[];
  flyTo?: { lat: number; lng: number } | null;
}

const PatrolMap = ({ patrollers, selectedId, onSelect, route = [], flyTo = null }: PatrolMapProps) => {
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
      <FlyToHandler flyTo={flyTo} />

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
            icon={createPatrollerIcon(p.status, isSelected, p.vehicle_type || 'car')}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          >
            <Popup className="dark-popup">
              <div className="text-sm">
                <p className="font-bold">{p.name}</p>
                <p className="text-xs opacity-70">{p.vehicle_plate || 'Sem placa'}</p>
                <p className="text-xs opacity-70">
                  {p.vehicle_type === 'motorcycle' ? '🏍️ Moto' : '🚗 Carro'}
                </p>
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
