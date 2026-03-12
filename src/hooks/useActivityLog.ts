import { supabase } from '@/integrations/supabase/client';

interface LogActivityParams {
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
}

export async function logActivity({ action, entityType, entityId, entityName, details }: LogActivityParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_email: user.email || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_name: entityName || null,
      details: details || {},
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}
