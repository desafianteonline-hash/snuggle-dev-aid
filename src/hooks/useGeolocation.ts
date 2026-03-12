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
  motionSpeed: number | null; // speed estimated from accelerometer
  isMoving: boolean; // detected via device motion
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

const SEND_INTERVAL_MS = 30000; // Send location every 30 seconds
const RETRY_DELAY_MS = 5000;
const MAX_QUEUE_SIZE = 200;
const QUEUE_STORAGE_KEY = 'patrol_offline_queue';
const WATCHDOG_INTERVAL_MS = 30000; // Check every 30s if GPS is still alive

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
  const watchdogInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const lastPositionTime = useRef<number>(0);
  const queueRef = useRef<QueuedLocation[]>([]);
  const isSending = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const shouldTrack = useRef(false);

  // Persist queue to localStorage for survival across page refreshes
  const persistQueue = useCallback(() => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queueRef.current));
    } catch {}
  }, []);

  const loadPersistedQueue = useCallback(() => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as QueuedLocation[];
        if (parsed.length > 0) {
          queueRef.current = parsed;
          setState(s => ({ ...s, pendingQueue: parsed.length }));
        }
      }
    } catch {}
  }, []);

  // Request Wake Lock to prevent screen from sleeping
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('[PatrolTrack] Wake Lock ativado');
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[PatrolTrack] Wake Lock liberado, re-solicitando...');
          // Re-request when released (e.g., tab switch)
          if (shouldTrack.current) {
            setTimeout(requestWakeLock, 1000);
          }
        });
      }
    } catch (err) {
      console.warn('[PatrolTrack] Wake Lock não disponível:', err);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Flush the queue - send all pending locations
  const flushQueue = useCallback(async () => {
    if (isSending.current || queueRef.current.length === 0) return;
    isSending.current = true;

    const batch = [...queueRef.current];

    try {
      const { error } = await supabase.from('patrol_locations').insert(batch);

      if (error) {
        console.error('[PatrolTrack] Erro ao enviar lote:', error);
        scheduleRetry();
      } else {
        queueRef.current = queueRef.current.slice(batch.length);
        persistQueue();
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
  }, [persistQueue]);

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

    if (queueRef.current.length >= MAX_QUEUE_SIZE) {
      queueRef.current = queueRef.current.slice(queueRef.current.length - MAX_QUEUE_SIZE + 1);
    }

    queueRef.current.push(entry);
    persistQueue();
    setState(s => ({ ...s, pendingQueue: queueRef.current.length }));

    flushQueue();
  }, [patrollerId, flushQueue, persistQueue]);

  const startGPSWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        lastPosition.current = position;
        lastPositionTime.current = Date.now();
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
        setState(s => ({ ...s, error: `Erro GPS: ${err.message}` }));
        // Auto-restart GPS after error
        if (shouldTrack.current) {
          setTimeout(() => {
            console.log('[PatrolTrack] Auto-reiniciando GPS após erro...');
            startGPSWatch();
          }, 5000);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 20000,
      }
    );
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocalização não suportada neste dispositivo' }));
      return;
    }

    shouldTrack.current = true;

    // Load any persisted offline queue
    loadPersistedQueue();

    // Start GPS
    startGPSWatch();

    // Send location on interval
    if (sendInterval.current) clearInterval(sendInterval.current);
    sendInterval.current = setInterval(enqueueLocation, intervalMs);

    // Send first location after brief delay
    setTimeout(enqueueLocation, 3000);

    // Watchdog: if no GPS update in 30s, restart the watch
    if (watchdogInterval.current) clearInterval(watchdogInterval.current);
    watchdogInterval.current = setInterval(() => {
      if (shouldTrack.current && Date.now() - lastPositionTime.current > WATCHDOG_INTERVAL_MS) {
        console.warn('[PatrolTrack] Watchdog: GPS silencioso, reiniciando...');
        startGPSWatch();
      }
    }, WATCHDOG_INTERVAL_MS);

    // Request Wake Lock
    requestWakeLock();

    setState(s => ({ ...s, tracking: true }));
  }, [enqueueLocation, intervalMs, startGPSWatch, loadPersistedQueue, requestWakeLock]);

  const stopTracking = useCallback(() => {
    shouldTrack.current = false;

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
    if (watchdogInterval.current) {
      clearInterval(watchdogInterval.current);
      watchdogInterval.current = null;
    }

    releaseWakeLock();

    // Send any remaining queued locations
    if (queueRef.current.length > 0) {
      flushQueue();
    }

    setState(s => ({ ...s, tracking: false }));
  }, [flushQueue, releaseWakeLock]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('[PatrolTrack] Dispositivo online - reenviando fila');
      flushQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushQueue]);

  // Handle visibility change - re-request wake lock and restart GPS if needed
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldTrack.current) {
        console.log('[PatrolTrack] App visível novamente, verificando GPS...');
        requestWakeLock();
        // If GPS has been silent, restart
        if (Date.now() - lastPositionTime.current > 15000) {
          startGPSWatch();
        }
        // Flush any queued data
        flushQueue();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [requestWakeLock, startGPSWatch, flushQueue]);

  // Send remaining data on page unload via sendBeacon
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (queueRef.current.length > 0 && patrollerId) {
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/patrol_locations`;
          const body = JSON.stringify(queueRef.current);
          navigator.sendBeacon(
            url + `?apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            new Blob([body], { type: 'application/json' })
          );
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [patrollerId]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  const forceImmediateSend = useCallback(() => {
    console.log('[PatrolTrack] Envio imediato solicitado');
    enqueueLocation();
  }, [enqueueLocation]);

  return { ...state, startTracking, stopTracking, forceImmediateSend };
}
