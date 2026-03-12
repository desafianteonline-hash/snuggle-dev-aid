import { useEffect, useRef, useCallback } from 'react';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';
import { useToast } from '@/hooks/use-toast';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 30_000; // check every 30s

export function useOfflineAlerts(patrollers: PatrollerWithLocation[]) {
  const notifiedRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const permissionRef = useRef<NotificationPermission>('default');

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
          tag: `offline-${patrollerName}`, // prevents duplicate notifications
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
          // Patroller went offline — notify
          notifiedRef.current.add(p.id);
          sendNotification(p.name, minutesOffline);
        } else if (elapsed <= OFFLINE_THRESHOLD_MS && notifiedRef.current.has(p.id)) {
          // Patroller came back online — clear notification flag
          notifiedRef.current.delete(p.id);
        }
      }
    };

    check(); // immediate check
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [patrollers, sendNotification]);
}
