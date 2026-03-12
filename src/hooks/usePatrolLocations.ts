import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type PatrollerWithLocation = Tables<'patrollers'> & {
  latest_location?: Tables<'patrol_locations'> | null;
};

export function usePatrolLocations() {
  const [patrollers, setPatrollers] = useState<PatrollerWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const pollIntervalRef = useRef(3000);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncRef = useRef<string | null>(null);
  const isActiveRef = useRef(true);

  // Full fetch of all patrollers with their latest location
  const fetchPatrollers = useCallback(async () => {
    try {
      const { data: patrollersData, error } = await supabase
        .from('patrollers')
        .select('*');

      if (error || !patrollersData) {
        console.error('[CODSEG GPS] Erro ao buscar patrulheiros:', error);
        return;
      }

      const withLocations = await Promise.all(
        patrollersData.map(async (p) => {
          const { data: loc } = await supabase
            .from('patrol_locations')
            .select('*')
            .eq('patroller_id', p.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return { ...p, latest_location: loc };
        })
      );

      setPatrollers(withLocations);
      setLoading(false);

      // Track latest sync time
      const latestTime = withLocations
        .map(p => p.latest_location?.recorded_at)
        .filter(Boolean)
        .sort()
        .pop();
      if (latestTime) lastSyncRef.current = latestTime;
    } catch (err) {
      console.error('[CODSEG GPS] Erro no fetch:', err);
    }
  }, []);

  // Incremental poll - only fetch new locations since last sync
  const pollNewLocations = useCallback(async () => {
    if (!isActiveRef.current) return;

    try {
      let query = supabase
        .from('patrol_locations')
        .select('*')
        .order('recorded_at', { ascending: false });

      if (lastSyncRef.current) {
        query = query.gt('recorded_at', lastSyncRef.current);
      }

      const { data: newLocations } = await query.limit(50);

      if (newLocations && newLocations.length > 0) {
        // Update patrollers with new locations
        setPatrollers(prev => {
          const updated = [...prev];
          for (const loc of newLocations) {
            const idx = updated.findIndex(p => p.id === loc.patroller_id);
            if (idx !== -1) {
              const current = updated[idx].latest_location;
              if (!current || loc.recorded_at > current.recorded_at) {
                updated[idx] = { ...updated[idx], latest_location: loc };
              }
            }
          }
          return updated;
        });

        // Update last sync
        const latest = newLocations
          .map(l => l.recorded_at)
          .sort()
          .pop();
        if (latest) lastSyncRef.current = latest;

        // Reset poll interval when data found
        pollIntervalRef.current = 3000;
      } else {
        // Back off slowly when no new data (max 15s)
        pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.3, 15000);
      }

      // Auto-mark patrollers offline if no location in 3 minutes
      const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000;
      const now = Date.now();

      // Also refresh patroller status periodically
      const { data: statusData } = await supabase
        .from('patrollers')
        .select('id, status');
      if (statusData) {
        setPatrollers(prev =>
          prev.map(p => {
            const s = statusData.find(sd => sd.id === p.id);
            const dbStatus = s ? s.status : p.status;
            
            // Check if last location is older than 3 minutes → force offline
            const lastRecorded = p.latest_location?.recorded_at;
            const isStale = lastRecorded && (now - new Date(lastRecorded).getTime()) > OFFLINE_THRESHOLD_MS;
            const effectiveStatus = isStale ? 'offline' : dbStatus;
            
            return { ...p, status: effectiveStatus };
          })
        );
      }
    } catch (err) {
      console.error('[PatrolTrack] Erro no polling:', err);
      pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, 30000);
    }

    // Schedule next poll
    if (isActiveRef.current) {
      pollTimeoutRef.current = setTimeout(pollNewLocations, pollIntervalRef.current);
    }
  }, []);

  useEffect(() => {
    isActiveRef.current = true;

    // Initial full fetch
    fetchPatrollers();

    // 1. Realtime subscription (primary)
    const channel = supabase
      .channel('patrol-locations-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'patrol_locations' },
        (payload) => {
          const newLocation = payload.new as Tables<'patrol_locations'>;
          console.log('[PatrolTrack] Realtime: nova localização recebida');

          setPatrollers(prev =>
            prev.map(p =>
              p.id === newLocation.patroller_id
                ? { ...p, latest_location: newLocation }
                : p
            )
          );

          if (newLocation.recorded_at) {
            lastSyncRef.current = newLocation.recorded_at;
          }

          // Reset poll interval since realtime is working
          pollIntervalRef.current = 5000;
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patrollers' },
        (payload) => {
          const updated = payload.new as Tables<'patrollers'>;
          setPatrollers(prev =>
            prev.map(p =>
              p.id === updated.id
                ? { ...p, ...updated, latest_location: p.latest_location }
                : p
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'patrollers' },
        () => {
          // New patroller added, do a full refresh
          fetchPatrollers();
        }
      )
      .subscribe((status, err) => {
        console.log('[PatrolTrack] Realtime status:', status, err);
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
          pollIntervalRef.current = 5000; // Relax polling when realtime is active
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeConnected(false);
          pollIntervalRef.current = 3000; // Increase polling frequency on realtime failure
          console.warn('[PatrolTrack] Realtime falhou, polling ativo como fallback');
        }
      });

    // 2. Polling fallback (always active, frequency adapts)
    pollTimeoutRef.current = setTimeout(pollNewLocations, pollIntervalRef.current);

    return () => {
      isActiveRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchPatrollers, pollNewLocations]);

  return { patrollers, loading, realtimeConnected, refetch: fetchPatrollers };
}
