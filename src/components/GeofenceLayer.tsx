import { useState, useMemo } from 'react';
import { Circle, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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
  onPendingLocationChange?: (lat: number, lng: number) => void;
}

function MapClickHandler({ onMapClick, onHover }: { onMapClick: (lat: number, lng: number) => void; onHover: (pos: { lat: number; lng: number } | null) => void }) {
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

function createPinIcon(color: string) {
  return L.divIcon({
    className: 'custom-geofence-pin',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
        <circle cx="16" cy="16" r="3" fill="${color}"/>
      </svg>
      <div style="font-size:9px;font-weight:700;color:${color};text-shadow:0 1px 2px rgba(0,0,0,0.5);margin-top:-2px;white-space:nowrap;">Arraste para mover</div>
    </div>`,
    iconSize: [80, 52],
    iconAnchor: [40, 40],
  });
}

export function GeofenceLayer({ geofences, onDelete, onMapClick, addMode, pendingLocation, pendingRadius = 200, pendingColor = '#3b82f6', onPendingLocationChange }: GeofenceLayerProps) {
  const [hoverPos, setHoverPos] = useState<{ lat: number; lng: number } | null>(null);

  const pinIcon = useMemo(() => createPinIcon(pendingColor), [pendingColor]);

  return (
    <>
      {addMode && onMapClick && !pendingLocation ? (
        <MapClickHandler onMapClick={onMapClick} onHover={setHoverPos} />
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

      {/* Confirmed pending location - draggable marker + circle */}
      {pendingLocation && (
        <>
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
          />
          <Marker
            position={[pendingLocation.lat, pendingLocation.lng]}
            icon={pinIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                onPendingLocationChange?.(pos.lat, pos.lng);
              },
            }}
          />
        </>
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
