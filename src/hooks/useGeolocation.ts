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
  lastSentAt: string | null;
  pendingQueue: number;
}

interface QueuedLocation {
  patroller_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
}

const SEND_INTERVAL_MS = 8000;
const RETRY_DELAY_MS = 5000;
const MAX_QUEUE_SIZE = 200;

export function useGeolocation(patrollerId: string | null, intervalMs = SEND_INTERVAL_MS) {
  const [state, setState] = useState<GeoState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    speed: null,
    heading: null,
    tracking: false,
    error: null,
    lastSentAt: null,
    pendingQueue: 0,
  });

  const watchId = useRef<number | null>(null);
  const sendInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const queueRef = useRef<QueuedLocation[]>([]);
  const isSending = useRef(false);

  // Flush the queue - send all pending locations
  const flushQueue = useCallback(async () => {
    if (isSending.current || queueRef.current.length === 0) return;
    isSending.current = true;

    const batch = [...queueRef.current];

    try {
      const { error } = await supabase.from('patrol_locations').insert(batch);

      if (error) {
        console.error('[PatrolTrack] Erro ao enviar lote:', error);
        // Keep items in queue for retry
        scheduleRetry();
      } else {
        // Success - remove sent items
        queueRef.current = queueRef.current.slice(batch.length);
        setState(s => ({
          ...s,
          lastSentAt: new Date().toISOString(),
          pendingQueue: queueRef.current.length,
        }));
        console.log(`[PatrolTrack] ${batch.length} localizações enviadas`);
      }
    } catch (err) {
      console.error('[PatrolTrack] Falha na rede:', err);
      scheduleRetry();
    }

    isSending.current = false;
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimeout.current) clearTimeout(retryTimeout.current);
    retryTimeout.current = setTimeout(() => {
      console.log('[PatrolTrack] Tentando reenviar fila...');
      flushQueue();
    }, RETRY_DELAY_MS);
  }, [flushQueue]);

  // Add current position to queue
  const enqueueLocation = useCallback(() => {
    const pos = lastPosition.current;
    if (!pos || !patrollerId) return;

    const entry: QueuedLocation = {
      patroller_id: patrollerId,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      recorded_at: new Date().toISOString(),
    };

    // Prevent queue from growing too large
    if (queueRef.current.length >= MAX_QUEUE_SIZE) {
      queueRef.current = queueRef.current.slice(queueRef.current.length - MAX_QUEUE_SIZE + 1);
    }

    queueRef.current.push(entry);
    setState(s => ({ ...s, pendingQueue: queueRef.current.length }));

    // Try to flush
    flushQueue();
  }, [patrollerId, flushQueue]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocalização não suportada neste dispositivo' }));
      return;
    }

    // Request permission and start watching
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
        console.error('[PatrolTrack] Erro GPS:', err.message);
        setState(s => ({ ...s, error: `Erro GPS: ${err.message}`, tracking: false }));
        // Try to restart after GPS error
        setTimeout(() => {
          if (watchId.current === null) startTracking();
        }, 10000);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 20000,
      }
    );

    // Send location on interval
    sendInterval.current = setInterval(enqueueLocation, intervalMs);

    // Send first location after brief delay
    setTimeout(enqueueLocation, 3000);

    setState(s => ({ ...s, tracking: true }));
  }, [enqueueLocation, intervalMs]);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (sendInterval.current) {
      clearInterval(sendInterval.current);
      sendInterval.current = null;
    }
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current);
      retryTimeout.current = null;
    }

    // Send any remaining queued locations
    if (queueRef.current.length > 0) {
      flushQueue();
    }

    setState(s => ({ ...s, tracking: false }));
  }, [flushQueue]);

  // Handle online/offline events - retry queue when back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('[PatrolTrack] Dispositivo online - reenviando fila');
      flushQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushQueue]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return { ...state, startTracking, stopTracking };
}
