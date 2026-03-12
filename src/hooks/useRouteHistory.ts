import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type LocationPoint = Tables<'patrol_locations'>;

export function useRouteHistory(patrollerId: string | null) {
  const [route, setRoute] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patrollerId) {
      setRoute([]);
      return;
    }

    let cancelled = false;

    const fetchRoute = async () => {
      setLoading(true);
      // Fetch last 24h of locations for this patroller
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('patrol_locations')
        .select('*')
        .eq('patroller_id', patrollerId)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
        .limit(1000);

      if (!cancelled) {
        setRoute(data || []);
        setLoading(false);
      }
    };

    fetchRoute();

    // Subscribe to new locations for this patroller to extend the route
    const channel = supabase
      .channel(`route-${patrollerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patrol_locations',
          filter: `patroller_id=eq.${patrollerId}`,
        },
        (payload) => {
          const newLoc = payload.new as LocationPoint;
          setRoute(prev => [...prev, newLoc]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [patrollerId]);

  return { route, loading };
}
