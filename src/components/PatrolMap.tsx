import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';

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

function createPatrollerIcon(status: string) {
  const color = statusColors[status] || '#6b7280';
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div class="pulse-ring" style="position:absolute;width:32px;height:32px;border-radius:50%;border:2px solid ${color};opacity:0.5;"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid hsl(220,18%,10%);box-shadow:0 0 8px ${color}80;"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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

interface PatrolMapProps {
  patrollers: PatrollerWithLocation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const PatrolMap = ({ patrollers, selectedId, onSelect }: PatrolMapProps) => {
  const defaultCenter: [number, number] = [-23.5505, -46.6333]; // São Paulo

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
      {patrollers.map(p => {
        if (!p.latest_location) return null;
        return (
          <Marker
            key={p.id}
            position={[p.latest_location.latitude, p.latest_location.longitude]}
            icon={createPatrollerIcon(p.status)}
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
