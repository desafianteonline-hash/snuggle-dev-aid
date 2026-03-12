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
    const { data, error } = await supabase
      .from('watch_points')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[WatchPoints] Erro ao buscar pontos:', error.message);
      setLoading(false);
      return;
    }

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
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[WatchPoints] Erro de sessão:', sessionError.message);
      return { error: 'Erro de autenticação. Faça login novamente.' };
    }

    const userId = session?.user?.id;
    if (!userId) {
      return { error: 'Sessão expirada. Faça login novamente.' };
    }

    const payload = { name, latitude, longitude, created_by: userId };
    console.log('[WatchPoints] Tentando inserir ponto:', payload);

    const { data, error } = await supabase
      .from('watch_points')
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[WatchPoints] Erro ao inserir ponto:', error.message);
      return { error: error.message || 'Falha ao salvar ponto.' };
    }

    if (data) {
      setPoints(prev => [...prev, data as WatchPoint]);
    } else {
      await fetchPoints();
    }

    return { error: null };
  }, [fetchPoints]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('watch_points').delete().eq('id', id);
    if (error) {
      console.error('[WatchPoints] Erro ao remover ponto:', error.message);
      return { error: error.message || null };
    }
    fetchPoints();
    return { error: null };
  }, [fetchPoints]);

  const update = useCallback(async (id: string, name: string, latitude: number, longitude: number) => {
    const { error } = await supabase.from('watch_points').update({ name, latitude, longitude }).eq('id', id);
    if (error) {
      console.error('[WatchPoints] Erro ao atualizar ponto:', error.message);
      return { error: error.message || null };
    }
    fetchPoints();
    return { error: null };
  }, [fetchPoints]);

  return { points, loading, add, remove, update, refetch: fetchPoints };
}
