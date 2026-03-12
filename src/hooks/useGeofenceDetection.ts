import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PatrollerWithLocation } from '@/hooks/usePatrolLocations';
import type { Geofence } from '@/hooks/useGeofences';
import { distanceMeters } from '@/hooks/useGeofences';

// Tracks which patrollers are inside which geofences
// Key: `${patrollerId}:${geofenceId}` → boolean (inside)
type StateMap = Record<string, boolean>;

export function useGeofenceDetection(
  patrollers: PatrollerWithLocation[],
  geofences: Geofence[],
  onEvent?: (event: { patrollerName: string; geofenceName: string; type: 'enter' | 'exit' }) => void,
) {
  const stateRef = useRef<StateMap>({});

  const detect = useCallback(async () => {
    if (geofences.length === 0) return;

    for (const p of patrollers) {
      if (!p.latest_location) continue;
      const { latitude, longitude } = p.latest_location;

      for (const g of geofences) {
        const key = `${p.id}:${g.id}`;
        const dist = distanceMeters(latitude, longitude, g.latitude, g.longitude);
        const inside = dist <= g.radius_meters;
        const wasInside = stateRef.current[key];

        // Skip first detection (initialization)
        if (wasInside === undefined) {
          stateRef.current[key] = inside;
          continue;
        }

        if (inside && !wasInside) {
          // ENTER event
          stateRef.current[key] = true;
          await supabase.from('geofence_events').insert({
            geofence_id: g.id,
            patroller_id: p.id,
            event_type: 'enter',
            latitude,
            longitude,
          } as any);
          onEvent?.({ patrollerName: p.name, geofenceName: g.name, type: 'enter' });
        } else if (!inside && wasInside) {
          // EXIT event
          stateRef.current[key] = false;
          await supabase.from('geofence_events').insert({
            geofence_id: g.id,
            patroller_id: p.id,
            event_type: 'exit',
            latitude,
            longitude,
          } as any);
          onEvent?.({ patrollerName: p.name, geofenceName: g.name, type: 'exit' });
        }
      }
    }
  }, [patrollers, geofences, onEvent]);

  useEffect(() => {
    detect();
  }, [detect]);
}
