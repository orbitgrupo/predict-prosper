import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, LogOut } from 'lucide-react';

interface CashoutButtonProps {
  bet: {
    id: string;
    option: string;
    amount: number;
    potential_payout: number | null;
    is_winner: boolean | null;
  };
  marketOptions: { option_name: string; total_amount: number }[];
  marketStatus: string;
  marketClosesAt: string;
  allowCashout: boolean;
}

export function CashoutButton({ bet, marketOptions, marketStatus, marketClosesAt, allowCashout }: CashoutButtonProps) {
  const [open, setOpen] = useState(false);
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isExpired = new Date(marketClosesAt) <= new Date();
  const canCashout = marketStatus === 'active' && !isExpired && bet.is_winner === null;

  // Calculate current cashout value
  const totalVolume = marketOptions.reduce((sum, o) => sum + o.total_amount, 0);
  const optionTotal = marketOptions.find(o => o.option_name === bet.option)?.total_amount || 0;
  const currentProbability = totalVolume > 0 ? optionTotal / totalVolume : 0;
  const cashoutValue = Math.round(bet.amount * (1 + (1 - currentProbability)) * 100) / 100;
  const cappedValue = bet.potential_payout && cashoutValue > bet.potential_payout 
    ? bet.potential_payout 
    : cashoutValue;
  const finalValue = Math.max(cappedValue, bet.amount * 0.01);
  const profitLoss = finalValue - bet.amount;

  const cashout = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No autenticado');
      const { data, error } = await supabase.rpc('cashout_bet', {
        p_bet_id: bet.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; cashout_value?: number };
      if (!result.success) throw new Error(result.error || 'Error al retirar');
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      queryClient.invalidateQueries({ queryKey: ['bets'] });
      refreshProfile();
      setOpen(false);
      toast({
        title: 'Retiro exitoso',
        description: `Recibiste $${Number(result.cashout_value).toFixed(2)} por tu apuesta.`,
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

  if (!canCashout) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <LogOut className="h-3.5 w-3.5" />
          Retirar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirar apuesta</DialogTitle>
          <DialogDescription>
            Puedes retirarte del mercado y recibir el valor actual de tu posición basado en las probabilidades actuales.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Apuesta original</span>
            <span className="font-medium">${bet.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Opción</span>
            <span className="font-medium">{bet.option}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Probabilidad actual</span>
            <span className="font-medium">{(currentProbability * 100).toFixed(1)}%</span>
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between text-sm font-bold">
              <span>Valor de retiro</span>
              <span className={profitLoss >= 0 ? 'text-green-500' : 'text-destructive'}>
                ${finalValue.toFixed(2)}
                <span className="ml-1 text-xs font-normal">
                  ({profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)})
                </span>
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => cashout.mutate()} disabled={cashout.isPending}>
            {cashout.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
            ) : (
              'Confirmar retiro'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
