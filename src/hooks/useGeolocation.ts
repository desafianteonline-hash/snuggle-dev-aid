import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

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
  motionSpeed: number | null;
  isMoving: boolean;
  isNative: boolean;
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

const SEND_INTERVAL_MS = 30000;
const RETRY_DELAY_MS = 5000;
const MAX_QUEUE_SIZE = 200;
const QUEUE_STORAGE_KEY = 'patrol_offline_queue';
const WATCHDOG_INTERVAL_MS = 30000;

export function useGeolocation(patrollerId: string | null, intervalMs = SEND_INTERVAL_MS) {
  const isNative = Capacitor.isNativePlatform();

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
    motionSpeed: null,
    isMoving: false,
    isNative,
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
  const velocityRef = useRef<number>(0);
  const lastMotionTime = useRef<number>(0);
  const bgWatcherRef = useRef<any>(null);

  // Persist queue to localStorage
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

  // Wake Lock (web only)
  const requestWakeLock = useCallback(async () => {
    if (isNative) return; // Not needed on native
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('[PatrolTrack] Wake Lock ativado');
        wakeLockRef.current.addEventListener('release', () => {
          if (shouldTrack.current) setTimeout(requestWakeLock, 1000);
        });
      }
    } catch (err) {
      console.warn('[PatrolTrack] Wake Lock não disponível:', err);
    }
  }, [isNative]);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Flush queue
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

  // Enqueue a location entry
  const enqueueEntry = useCallback((lat: number, lng: number, accuracy: number | null, speed: number | null, heading: number | null) => {
    if (!patrollerId) return;
    const entry: QueuedLocation = {
      patroller_id: patrollerId,
      latitude: lat,
      longitude: lng,
      accuracy,
      speed,
      heading,
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

  // Enqueue from web geolocation
  const enqueueLocation = useCallback(() => {
    const pos = lastPosition.current;
    if (!pos || !patrollerId) return;
    enqueueEntry(
      pos.coords.latitude,
      pos.coords.longitude,
      pos.coords.accuracy,
      pos.coords.speed,
      pos.coords.heading,
    );
  }, [patrollerId, enqueueEntry]);

  // --- Web GPS ---
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
        if (shouldTrack.current) {
          setTimeout(startGPSWatch, 5000);
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
  }, []);

  // --- Capacitor Background Geolocation ---
  const startNativeTracking = useCallback(async () => {
    try {
      const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');

      bgWatcherRef.current = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Rastreamento de patrulha ativo',
          backgroundTitle: 'PatrolTrack',
          requestPermissions: true,
          stale: false,
          distanceFilter: 10, // minimum 10m between updates
        },
        (location, error) => {
          if (error) {
            console.error('[PatrolTrack Native] Erro:', error);
            if (error.code === 'NOT_AUTHORIZED') {
              setState(s => ({ ...s, error: 'Permissão de localização negada. Ative nas configurações.' }));
            }
            return;
          }
          if (location) {
            lastPositionTime.current = Date.now();
            setState(s => ({
              ...s,
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              speed: location.speed,
              heading: location.bearing,
              tracking: true,
              error: null,
              isMoving: (location.speed || 0) > 0.5,
            }));

            // Enqueue directly from native location
            enqueueEntry(
              location.latitude,
              location.longitude,
              location.accuracy,
              location.speed,
              location.bearing,
            );
          }
        },
      );

      console.log('[PatrolTrack] Background Geolocation nativo iniciado');
      setState(s => ({ ...s, tracking: true }));
    } catch (err) {
      console.error('[PatrolTrack] Erro ao iniciar rastreamento nativo:', err);
      setState(s => ({ ...s, error: 'Erro ao iniciar GPS nativo' }));
      // Fallback to web GPS
      startGPSWatch();
    }
  }, [enqueueEntry, startGPSWatch]);

  const stopNativeTracking = useCallback(async () => {
    if (bgWatcherRef.current != null) {
      try {
        const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
        await BackgroundGeolocation.removeWatcher({ id: bgWatcherRef.current });
        bgWatcherRef.current = null;
      } catch (err) {
        console.error('[PatrolTrack] Erro ao parar rastreamento nativo:', err);
      }
    }
  }, []);

  // --- DeviceMotion (web only) ---
  const motionHandlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const startDeviceMotion = useCallback(() => {
    if (isNative || !window.DeviceMotionEvent) return;

    const requestPermission = async () => {
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        try {
          const perm = await (DeviceMotionEvent as any).requestPermission();
          if (perm !== 'granted') return;
        } catch { return; }
      }

      const ACCEL_THRESHOLD = 0.5;
      const DECAY = 0.95;

      const handler = (event: DeviceMotionEvent) => {
        const accel = event.accelerationIncludingGravity;
        if (!accel || accel.x == null || accel.y == null || accel.z == null) return;
        const now = Date.now();
        const dt = lastMotionTime.current ? (now - lastMotionTime.current) / 1000 : 0;
        lastMotionTime.current = now;
        if (dt <= 0 || dt > 1) return;
        const linMag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + (accel.z - 9.81) ** 2);
        if (linMag > ACCEL_THRESHOLD) {
          velocityRef.current += linMag * dt;
        } else {
          velocityRef.current *= DECAY;
        }
        velocityRef.current = Math.min(velocityRef.current, 55);
        if (velocityRef.current < 0.3) velocityRef.current = 0;
        const isMoving = velocityRef.current > 0.5;
        const motionSpeedKmh = velocityRef.current * 3.6;
        setState(s => ({
          ...s,
          motionSpeed: motionSpeedKmh > 0 ? motionSpeedKmh : null,
          isMoving,
        }));
      };

      motionHandlerRef.current = handler;
      window.addEventListener('devicemotion', handler, { passive: true });
      console.log('[PatrolTrack] DeviceMotion (acelerômetro) ativado');
    };

    requestPermission();
  }, [isNative]);

  const stopDeviceMotion = useCallback(() => {
    if (motionHandlerRef.current) {
      window.removeEventListener('devicemotion', motionHandlerRef.current);
      motionHandlerRef.current = null;
    }
    velocityRef.current = 0;
    lastMotionTime.current = 0;
  }, []);

  // --- Start / Stop ---
  const startTracking = useCallback(() => {
    shouldTrack.current = true;
    loadPersistedQueue();

    if (isNative) {
      // Use Capacitor background geolocation (works even when app is closed)
      startNativeTracking();
    } else {
      // Web fallback
      if (!navigator.geolocation) {
        setState(s => ({ ...s, error: 'Geolocalização não suportada neste dispositivo' }));
        return;
      }
      startGPSWatch();
      startDeviceMotion();

      // Send location on interval (web only - native sends on each location update)
      if (sendInterval.current) clearInterval(sendInterval.current);
      sendInterval.current = setInterval(enqueueLocation, intervalMs);
      setTimeout(enqueueLocation, 3000);

      // Watchdog
      if (watchdogInterval.current) clearInterval(watchdogInterval.current);
      watchdogInterval.current = setInterval(() => {
        if (shouldTrack.current && Date.now() - lastPositionTime.current > WATCHDOG_INTERVAL_MS) {
          console.warn('[PatrolTrack] Watchdog: GPS silencioso, reiniciando...');
          startGPSWatch();
        }
      }, WATCHDOG_INTERVAL_MS);

      requestWakeLock();
    }

    setState(s => ({ ...s, tracking: true }));
  }, [isNative, enqueueLocation, intervalMs, startGPSWatch, startNativeTracking, startDeviceMotion, loadPersistedQueue, requestWakeLock]);

  const stopTracking = useCallback(() => {
    shouldTrack.current = false;

    if (isNative) {
      stopNativeTracking();
    } else {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (sendInterval.current) {
        clearInterval(sendInterval.current);
        sendInterval.current = null;
      }
      if (watchdogInterval.current) {
        clearInterval(watchdogInterval.current);
        watchdogInterval.current = null;
      }
      releaseWakeLock();
      stopDeviceMotion();
    }

    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current);
      retryTimeout.current = null;
    }

    if (queueRef.current.length > 0) flushQueue();
    setState(s => ({ ...s, tracking: false }));
  }, [isNative, flushQueue, releaseWakeLock, stopNativeTracking, stopDeviceMotion]);

  // Handle online/offline
  useEffect(() => {
    const handleOnline = () => {
      console.log('[PatrolTrack] Dispositivo online - reenviando fila');
      flushQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushQueue]);

  // Visibility change (web only)
  useEffect(() => {
    if (isNative) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldTrack.current) {
        console.log('[PatrolTrack] App visível novamente, verificando GPS...');
        requestWakeLock();
        if (Date.now() - lastPositionTime.current > 15000) startGPSWatch();
        flushQueue();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isNative, requestWakeLock, startGPSWatch, flushQueue]);

  // sendBeacon on unload (web only)
  useEffect(() => {
    if (isNative) return;
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
  }, [isNative, patrollerId]);

  // Cleanup
  useEffect(() => {
    return () => { stopTracking(); };
  }, [stopTracking]);

  const forceImmediateSend = useCallback(() => {
    console.log('[PatrolTrack] Envio imediato solicitado');
    if (isNative) {
      // On native, the last state values are the current position
      if (state.latitude && state.longitude) {
        enqueueEntry(state.latitude, state.longitude, state.accuracy, state.speed, state.heading);
      }
    } else {
      enqueueLocation();
    }
  }, [isNative, state.latitude, state.longitude, state.accuracy, state.speed, state.heading, enqueueEntry, enqueueLocation]);

  return { ...state, startTracking, stopTracking, forceImmediateSend };
}
