import { useEffect, useRef, useCallback } from 'react';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';
import { useToast } from '@/hooks/use-toast';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 30_000; // check every 30s

// Generate alert beep using Web Audio API
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBeep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    // 3 urgent beeps
    playBeep(880, 0, 0.15);
    playBeep(880, 0.2, 0.15);
    playBeep(1100, 0.4, 0.3);
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // Audio not supported
  }
}

export function useOfflineAlerts(patrollers: PatrollerWithLocation[], soundEnabled: boolean) {
  const notifiedRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const permissionRef = useRef<NotificationPermission>('default');
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      permissionRef.current = Notification.permission;
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(p => {
          permissionRef.current = p;
        });
      }
    }
  }, []);

  const sendNotification = useCallback((patrollerName: string, minutesOffline: number) => {
    const title = '⚠️ Patrulheiro Offline';
    const body = `${patrollerName} está offline há ${minutesOffline} minutos`;

    // Play sound if enabled
    if (soundEnabledRef.current) {
      playAlertSound();
    }

    // In-app toast always
    toast({
      title,
      description: body,
      variant: 'destructive',
      duration: 10000,
    });

    // Browser push notification
    if ('Notification' in window && permissionRef.current === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `offline-${patrollerName}`,
          requireInteraction: true,
        });
      } catch {
        // Fallback: notification not supported in this context
      }
    }
  }, [toast]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();

      for (const p of patrollers) {
        const lastRecorded = p.latest_location?.recorded_at;
        if (!lastRecorded) continue;

        const elapsed = now - new Date(lastRecorded).getTime();
        const minutesOffline = Math.floor(elapsed / 60000);

        if (elapsed > OFFLINE_THRESHOLD_MS && !notifiedRef.current.has(p.id)) {
          notifiedRef.current.add(p.id);
          sendNotification(p.name, minutesOffline);
        } else if (elapsed <= OFFLINE_THRESHOLD_MS && notifiedRef.current.has(p.id)) {
          notifiedRef.current.delete(p.id);
        }
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [patrollers, sendNotification]);
}
