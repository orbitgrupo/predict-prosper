import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowDownLeft, ArrowUpRight, Gift, Loader2, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TransactionHistoryProps {
  userId: string;
}

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  market_id: string | null;
};

export function TransactionHistory({ userId }: TransactionHistoryProps) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!userId,
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'bonus':
        return <Gift className="h-4 w-4" />;
      case 'bet':
        return <ArrowUpRight className="h-4 w-4" />;
      case 'payout':
        return <ArrowDownLeft className="h-4 w-4" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    if (amount > 0) return 'text-success';
    if (amount < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'bonus':
        return <Badge variant="secondary" className="bg-primary/10 text-primary">Bono</Badge>;
      case 'bet':
        return <Badge variant="secondary" className="bg-warning/10 text-warning">Apuesta</Badge>;
      case 'payout':
        return <Badge variant="secondary" className="bg-success/10 text-success">Pago</Badge>;
      case 'deposit':
        return <Badge variant="secondary" className="bg-success/10 text-success">Depósito</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Historial de transacciones</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions && transactions.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${getTransactionColor(transaction.type, transaction.amount)}`}>
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {getTransactionBadge(transaction.type)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {transaction.description || 'Sin descripción'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(transaction.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <p className={`font-display font-bold ${getTransactionColor(transaction.type, transaction.amount)}`}>
                    {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center">
            <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              No hay transacciones todavía.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
