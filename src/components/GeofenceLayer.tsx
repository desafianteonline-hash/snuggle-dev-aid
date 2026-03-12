import { useState } from 'react';
import { Circle, Popup, useMapEvents } from 'react-leaflet';
import type { Geofence } from '@/hooks/useGeofences';
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

function MapClickHandler({ onMapClick, onHover, radius }: { onMapClick: (lat: number, lng: number) => void; onHover: (pos: { lat: number; lng: number } | null) => void; radius: number }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
    mousemove(e) {
      onHover({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    mouseout() {
      onHover(null);
    },
  });

  // Change cursor to crosshair
  const map = useMapEvents({} as any);
  if (map) {
    map.getContainer().style.cursor = 'crosshair';
  }

  return null;
}

function RestoreCursor() {
  const map = useMapEvents({} as any);
  if (map) {
    map.getContainer().style.cursor = '';
  }
  return null;
}

export function GeofenceLayer({ geofences, onDelete, onMapClick, addMode, pendingLocation, pendingRadius = 200, pendingColor = '#3b82f6' }: GeofenceLayerProps) {
  const [hoverPos, setHoverPos] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <>
      {addMode && onMapClick ? (
        <MapClickHandler onMapClick={onMapClick} onHover={setHoverPos} radius={pendingRadius} />
      ) : (
        <RestoreCursor />
      )}

      {/* Hover preview circle following cursor */}
      {addMode && hoverPos && !pendingLocation && (
        <Circle
          center={[hoverPos.lat, hoverPos.lng]}
          radius={pendingRadius}
          pathOptions={{
            color: pendingColor,
            fillColor: pendingColor,
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '4 4',
          }}
        />
      )}

      {/* Confirmed pending location circle */}
      {pendingLocation && (
        <Circle
          center={[pendingLocation.lat, pendingLocation.lng]}
          radius={pendingRadius}
          pathOptions={{
            color: pendingColor,
            fillColor: pendingColor,
            fillOpacity: 0.25,
            weight: 3,
            dashArray: '8 4',
          }}
        >
          <Popup>
            <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>Nova cerca</p>
            <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>Raio: {pendingRadius}m</p>
          </Popup>
        </Circle>
      )}

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
