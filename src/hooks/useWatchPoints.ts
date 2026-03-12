import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WatchPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_by: string;
  created_at: string;
}

export function useWatchPoints() {
  const [points, setPoints] = useState<WatchPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPoints = useCallback(async () => {
    const { data } = await supabase
      .from('watch_points')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) setPoints(data as WatchPoint[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPoints();

    // Realtime subscription
    const channel = supabase
      .channel('watch-points-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watch_points' },
        () => {
          console.log('[WatchPoints] Realtime update received');
          fetchPoints();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPoints]);

  const add = useCallback(async (name: string, latitude: number, longitude: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Não autenticado' };
    const { error } = await supabase.from('watch_points').insert({
      name, latitude, longitude, created_by: user.id,
    });
    if (!error) fetchPoints();
    return { error: error?.message || null };
  }, [fetchPoints]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('watch_points').delete().eq('id', id);
    if (!error) fetchPoints();
    return { error: error?.message || null };
  }, [fetchPoints]);

  const update = useCallback(async (id: string, name: string, latitude: number, longitude: number) => {
    const { error } = await supabase.from('watch_points').update({ name, latitude, longitude }).eq('id', id);
    if (!error) fetchPoints();
    return { error: error?.message || null };
  }, [fetchPoints]);

  return { points, loading, add, remove, update, refetch: fetchPoints };
}
