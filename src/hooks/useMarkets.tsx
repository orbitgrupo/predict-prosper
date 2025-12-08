import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;
  option: 'yes' | 'no';
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
        .select('*')
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
        .select('*')
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
      option: 'yes' | 'no'; 
      amount: number;
    }) => {
      // Get current profile balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      
      const currentBalance = Number(profile.balance);
      if (currentBalance < amount) {
        throw new Error('Saldo insuficiente');
      }

      // Get current market totals
      const { data: market, error: marketError } = await supabase
        .from('markets')
        .select('total_yes_amount, total_no_amount, status')
        .eq('id', marketId)
        .single();

      if (marketError) throw marketError;
      if (market.status !== 'active') {
        throw new Error('Este mercado ya no está activo');
      }

      // Place the bet
      const { error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: userId,
          market_id: marketId,
          option,
          amount,
        });

      if (betError) throw betError;

      // Update user balance
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ balance: currentBalance - amount })
        .eq('id', userId);

      if (balanceError) throw balanceError;

      // Update market totals
      const updateField = option === 'yes' ? 'total_yes_amount' : 'total_no_amount';
      const currentTotal = option === 'yes' 
        ? Number(market.total_yes_amount) 
        : Number(market.total_no_amount);

      const { error: marketUpdateError } = await supabase
        .from('markets')
        .update({ [updateField]: currentTotal + amount })
        .eq('id', marketId);

      if (marketUpdateError) throw marketUpdateError;

      // Record transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'bet',
          amount: -amount,
          description: `Apuesta en mercado: ${option.toUpperCase()}`,
          market_id: marketId,
        });

      if (txError) throw txError;

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
