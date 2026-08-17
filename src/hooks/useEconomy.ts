import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type EconomyMode = 'points' | 'real_money';

export function useEconomy() {
  const query = useQuery({
    queryKey: ['economy-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (error) throw error;
      return ((data as any).economy_mode || 'points') as EconomyMode;
    },
    staleTime: 30_000,
  });

  const mode = query.data || 'points';
  const isRealMoney = mode === 'real_money';
  const formatAmount = (value: number, decimals = 2) => {
    const formatted = Number(value || 0).toLocaleString('es-ES', {
      minimumFractionDigits: isRealMoney ? decimals : 0,
      maximumFractionDigits: decimals,
    });
    return isRealMoney ? '$' + formatted : formatted + ' pts';
  };

  return { ...query, mode, isRealMoney, formatAmount, unitLabel: isRealMoney ? 'dinero' : 'puntos' };
}
