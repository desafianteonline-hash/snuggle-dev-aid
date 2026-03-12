import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';
import type { LocationPoint } from '@/hooks/useRouteHistory';
import MapLayerControl from '@/components/MapLayerControl';
import GeofenceLayer from '@/components/GeofenceLayer';
import type { Geofence } from '@/hooks/useGeofences';

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
};

const carSvg = (color: string, size: number) => `
<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 18C4 16 5 14 6 13L9 8C10 6.5 11.5 6 13 6H19C20.5 6 22 6.5 23 8L26 13C27 14 28 16 28 18V22C28 23.1 27.1 24 26 24H6C4.9 24 4 23.1 4 22V18Z" fill="${color}"/>
  <path d="M9.5 13L11.5 8.5C12 7.5 12.5 7.5 13 7.5H19C19.5 7.5 20 7.5 20.5 8.5L22.5 13" stroke="rgba(0,0,0,0.3)" stroke-width="0.8" fill="rgba(180,220,255,0.4)"/>
  <rect x="5" y="14" width="3" height="2" rx="1" fill="rgba(255,255,200,0.9)"/>
  <rect x="24" y="14" width="3" height="2" rx="1" fill="rgba(255,255,200,0.9)"/>
  <circle cx="9.5" cy="24" r="3" fill="#1a1a2e" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>
  <circle cx="9.5" cy="24" r="1.2" fill="rgba(255,255,255,0.15)"/>
  <circle cx="22.5" cy="24" r="3" fill="#1a1a2e" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>
  <circle cx="22.5" cy="24" r="1.2" fill="rgba(255,255,255,0.15)"/>
</svg>`;

const motorcycleSvg = (color: string, size: number) => `
<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="6" cy="22" r="4.5" fill="#1a1a2e" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>
  <circle cx="6" cy="22" r="1.5" fill="rgba(255,255,255,0.15)"/>
  <circle cx="26" cy="22" r="4.5" fill="#1a1a2e" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>
  <circle cx="26" cy="22" r="1.5" fill="rgba(255,255,255,0.15)"/>
  <path d="M6 22L12 12L18 10L26 22" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <ellipse cx="15" cy="13" rx="4" ry="2.5" fill="${color}"/>
  <path d="M13 11C13 10 14 9 16 9C18 9 19.5 10 19 11" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M18 10L20 7M18 10L22 8" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="21" cy="7.5" r="1.5" fill="rgba(255,255,200,0.9)"/>
  <path d="M8 20L4 21" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round"/>
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
  geofences?: Geofence[];
  onGeofenceDelete?: (id: string) => void;
  geofenceAddMode?: boolean;
  onGeofenceMapClick?: (lat: number, lng: number) => void;
}

const PatrolMap = ({ patrollers, selectedId, onSelect, route = [], flyTo = null, geofences = [], onGeofenceDelete, geofenceAddMode, onGeofenceMapClick }: PatrolMapProps) => {
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
      <MapLayerControl />
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
            icon={createPatrollerIcon(p.status, isSelected, p.vehicle_type || 'car', p.name, p.vehicle_plate || '')}
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
