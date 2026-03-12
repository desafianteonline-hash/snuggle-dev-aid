import { Circle, Popup, useMapEvents } from 'react-leaflet';
import type { Geofence } from '@/hooks/useGeofences';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface GeofenceLayerProps {
  geofences: Geofence[];
  onDelete?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  addMode?: boolean;
  pendingLocation?: { lat: number; lng: number } | null;
  pendingRadius?: number;
  pendingColor?: string;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function GeofenceLayer({ geofences, onDelete, onMapClick, addMode }: GeofenceLayerProps) {
  return (
    <>
      {addMode && onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      {geofences.map(g => (
        <Circle
          key={g.id}
          center={[g.latitude, g.longitude]}
          radius={g.radius_meters}
          pathOptions={{
            color: g.color,
            fillColor: g.color,
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '6 4',
          }}
        >
          <Popup>
            <div style={{ minWidth: 120 }}>
              <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>{g.name}</p>
              <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>
                Raio: {g.radius_meters}m
              </p>
              {onDelete && (
                <button
                  onClick={() => onDelete(g.id)}
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    color: '#ef4444',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={12} /> Remover
                </button>
              )}
            </div>
          </Popup>
        </Circle>
      ))}
    </>
  );
}

export default GeofenceLayer;
