import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GeoState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  tracking: boolean;
  error: string | null;
}

export function useGeolocation(patrollerId: string | null, intervalMs = 10000) {
  const [state, setState] = useState<GeoState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    speed: null,
    heading: null,
    tracking: false,
    error: null,
  });

  const watchId = useRef<number | null>(null);
  const sendInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);

  const sendLocation = useCallback(async () => {
    const pos = lastPosition.current;
    if (!pos || !patrollerId) return;

    await supabase.from('patrol_locations').insert({
      patroller_id: patrollerId,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
    });
  }, [patrollerId]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocalização não suportada' }));
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        lastPosition.current = position;
        setState(s => ({
          ...s,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          tracking: true,
          error: null,
        }));
      },
      (err) => {
        setState(s => ({ ...s, error: err.message, tracking: false }));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Send location periodically
    sendInterval.current = setInterval(sendLocation, intervalMs);
    // Also send immediately on first position
    setTimeout(sendLocation, 2000);

    setState(s => ({ ...s, tracking: true }));
  }, [sendLocation, intervalMs]);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (sendInterval.current) {
      clearInterval(sendInterval.current);
      sendInterval.current = null;
    }
    setState(s => ({ ...s, tracking: false }));
  }, []);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return { ...state, startTracking, stopTracking };
}
