import { useState, useEffect, useRef, useCallback } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { format } from 'date-fns';

interface LocationPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  speed?: number | null;
}

interface RouteReplayProps {
  points: LocationPoint[];
}

const SPEEDS = [1, 2, 5, 10];

function createReplayIcon() {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 20px; height: 20px;
        background: hsl(142, 70%, 45%);
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 12px hsl(142, 70%, 45%, 0.7);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function ReplayMarker({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(position, { animate: true, duration: 0.3 });
  }, [position, map]);

  return <Marker position={position} icon={createReplayIcon()} zIndexOffset={2000} />;
}

export function RouteReplayControls({ points }: RouteReplayProps) {
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const speed = SPEEDS[speedIdx];

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    stop();
    setPlaying(true);
    intervalRef.current = setInterval(() => {
      setIndex(prev => {
        if (prev >= points.length - 1) {
          stop();
          return prev;
        }
        return prev + 1;
      });
    }, 200 / speed);
  }, [points.length, speed, stop]);

  useEffect(() => {
    if (playing) play();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [speed]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  if (points.length < 2) return null;

  const current = points[index];
  const position: [number, number] = [current.latitude, current.longitude];

  return (
    <>
      <ReplayMarker position={position} />
      <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'auto' }}>
        <div
          className="leaflet-control"
          style={{
            marginBottom: 20,
            marginLeft: 10,
            background: 'hsl(220, 18%, 10%)',
            border: '1px solid hsl(220, 14%, 18%)',
            borderRadius: 10,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 320,
            color: 'hsl(210, 20%, 92%)',
            fontSize: 12,
          }}
        >
          <button
            onClick={() => { setIndex(0); stop(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 4 }}
            title="Reiniciar"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => playing ? stop() : play()}
            style={{
              background: 'hsl(142, 70%, 45%)',
              border: 'none',
              cursor: 'pointer',
              color: 'hsl(220, 20%, 7%)',
              borderRadius: 6,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={playing ? 'Pausar' : 'Reproduzir'}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={() => setSpeedIdx((speedIdx + 1) % SPEEDS.length)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 4, fontWeight: 700, fontSize: 11 }}
            title="Velocidade"
          >
            {speed}x
          </button>
          <input
            type="range"
            min={0}
            max={points.length - 1}
            value={index}
            onChange={(e) => { stop(); setIndex(Number(e.target.value)); }}
            style={{ flex: 1, accentColor: 'hsl(142, 70%, 45%)' }}
          />
          <span style={{ fontSize: 10, whiteSpace: 'nowrap', opacity: 0.7 }}>
            {format(new Date(current.recorded_at), 'HH:mm:ss')}
          </span>
          {current.speed != null && (
            <span style={{ fontSize: 10, whiteSpace: 'nowrap', fontWeight: 700 }}>
              {(current.speed * 3.6).toFixed(0)} km/h
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export default RouteReplayControls;
