import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MarketOption {
  id: string;
  market_id: string;
  option_name: string;
  total_amount: number;
  created_at: string;
}

export interface Market {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  closes_at: string;
  status: 'active' | 'closed' | 'resolved';
  resolved_option: string | null;
  total_yes_amount: number;
  total_no_amount: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  allow_cashout: boolean;
  options?: MarketOption[];
}

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;
  option: string;
  amount: number;
  potential_payout: number | null;
  is_winner: boolean | null;
  payout_amount: number | null;
  created_at: string;
}

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select(`
          *,
          options:market_options(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Market[];
    },
  });
}

export function useMarket(id: string) {
  return useQuery({
    queryKey: ['market', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select(`
          *,
          options:market_options(*)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Market | null;
    },
    enabled: !!id,
  });
}

export function useUserBets(userId: string | undefined) {
  return useQuery({
    queryKey: ['bets', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('bets')
        .select('*, markets(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function usePlaceBet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      marketId, 
      userId, 
      option, 
      amount 
    }: { 
      marketId: string; 
      userId: string; 
      option: string; 
      amount: number;
    }) => {
      // Use atomic server-side function for betting
      const { data, error } = await supabase.rpc('place_bet', {
        p_user_id: userId,
        p_market_id: marketId,
        p_option: option,
        p_amount: amount,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; bet_id?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Error al realizar la apuesta');
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      queryClient.invalidateQueries({ queryKey: ['bets'] });
      toast({
        title: 'Apuesta realizada',
        description: 'Tu apuesta se ha registrado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
