import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  color: string;
  created_by: string;
  created_at: string;
  active: boolean;
}

export interface GeofenceEvent {
  id: string;
  geofence_id: string;
  patroller_id: string;
  event_type: 'enter' | 'exit';
  latitude: number;
  longitude: number;
  recorded_at: string;
}

export function useGeofences() {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGeofences = useCallback(async () => {
    const { data } = await supabase
      .from('geofences')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (data) setGeofences(data as Geofence[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGeofences();
  }, [fetchGeofences]);

  const addGeofence = useCallback(async (geofence: Omit<Geofence, 'id' | 'created_at' | 'active'>) => {
    const { data, error } = await supabase
      .from('geofences')
      .insert(geofence as any)
      .select()
      .single();
    if (data) setGeofences(prev => [data as Geofence, ...prev]);
    return { data, error };
  }, []);

  const removeGeofence = useCallback(async (id: string) => {
    await supabase.from('geofences').delete().eq('id', id);
    setGeofences(prev => prev.filter(g => g.id !== id));
  }, []);

  const updateGeofence = useCallback(async (id: string, updates: Partial<Geofence>) => {
    const { data } = await supabase
      .from('geofences')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    if (data) setGeofences(prev => prev.map(g => g.id === id ? data as Geofence : g));
  }, []);

  return { geofences, loading, addGeofence, removeGeofence, updateGeofence, refetch: fetchGeofences };
}

// Haversine distance in meters
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
