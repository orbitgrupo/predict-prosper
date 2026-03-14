import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = useCallback(
    async (action: string, targetType: string, targetId?: string, details?: Record<string, any>) => {
      if (!user) return;
      await supabase.from('audit_logs' as any).insert({
        admin_id: user.id,
        action,
        target_type: targetType,
        target_id: targetId || null,
        details: details || {},
      });
    },
    [user]
  );

  return { logAction };
}
