import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type PatrollerWithLocation = Tables<'patrollers'> & {
  latest_location?: Tables<'patrol_locations'> | null;
};

export function usePatrolLocations() {
  const [patrollers, setPatrollers] = useState<PatrollerWithLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatrollers = useCallback(async () => {
    const { data: patrollersData } = await supabase
      .from('patrollers')
      .select('*');

    if (!patrollersData) return;

    // Get latest location for each patroller
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
  }, []);

  useEffect(() => {
    fetchPatrollers();

    // Subscribe to real-time location updates
    const channel = supabase
      .channel('patrol-locations-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'patrol_locations' },
        (payload) => {
          const newLocation = payload.new as Tables<'patrol_locations'>;
          setPatrollers(prev =>
            prev.map(p =>
              p.id === newLocation.patroller_id
                ? { ...p, latest_location: newLocation }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPatrollers]);

  return { patrollers, loading, refetch: fetchPatrollers };
}
