import { useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { Layers, Map, Satellite, Moon } from 'lucide-react';

const TILE_LAYERS = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    label: 'Padrão',
    icon: Map,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    label: 'Satélite',
    icon: Satellite,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    label: 'Escuro',
    icon: Moon,
  },
} as const;

type LayerKey = keyof typeof TILE_LAYERS;

interface MapLayerControlProps {
  defaultLayer?: LayerKey;
}

export function MapLayerControl({ defaultLayer = 'standard' }: MapLayerControlProps) {
  const [activeLayer, setActiveLayer] = useState<LayerKey>(defaultLayer);
  const [open, setOpen] = useState(false);

  const layer = TILE_LAYERS[activeLayer];

  return (
    <>
      <TileLayer key={activeLayer} url={layer.url} attribution={layer.attribution} />
      <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto' }}>
        <div
          className="leaflet-control"
          style={{
            marginTop: 10,
            marginRight: 10,
            position: 'relative',
            zIndex: 1000,
          }}
        >
          <button
            onClick={() => setOpen(!open)}
            style={{
              width: 34,
              height: 34,
              background: 'hsl(220, 18%, 10%)',
              border: '2px solid hsl(220, 14%, 18%)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'hsl(210, 20%, 92%)',
            }}
            title="Camadas do mapa"
          >
            <Layers size={16} />
          </button>
          {open && (
            <div
              style={{
                position: 'absolute',
                top: 38,
                right: 0,
                background: 'hsl(220, 18%, 10%)',
                border: '1px solid hsl(220, 14%, 18%)',
                borderRadius: 8,
                padding: 4,
                minWidth: 130,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {(Object.keys(TILE_LAYERS) as LayerKey[]).map((key) => {
                const t = TILE_LAYERS[key];
                const Icon = t.icon;
                const isActive = key === activeLayer;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveLayer(key);
                      setOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 400,
                      background: isActive ? 'hsl(142, 70%, 45%)' : 'transparent',
                      color: isActive ? 'hsl(220, 20%, 7%)' : 'hsl(210, 20%, 82%)',
                    }}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default MapLayerControl;
