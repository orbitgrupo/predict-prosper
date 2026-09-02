import { Link } from 'react-router-dom';
import { useUserBets } from '@/hooks/useMarkets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, TrendingUp, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BettingHistoryProps {
  userId: string;
}

export function BettingHistory({ userId }: BettingHistoryProps) {
  const { data: bets, isLoading } = useUserBets(userId);

  const getStatusBadge = (bet: any) => {
    if (bet.is_winner === null) {
      return (
        <Badge variant="secondary" className="bg-warning/10 text-warning gap-1">
          <Clock className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }
    if (bet.is_winner) {
      return (
        <Badge variant="secondary" className="bg-success/10 text-success gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Ganada
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-destructive/10 text-destructive gap-1">
        <XCircle className="h-3 w-3" />
        Perdida
      </Badge>
    );
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
        <CardTitle className="text-lg">Historial de apuestas</CardTitle>
      </CardHeader>
      <CardContent>
        {bets && bets.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {bets.map((bet: any) => (
                <Link
                  key={bet.id}
                  to={`/market/${bet.market_id}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-secondary/50 transition-colors block"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={bet.option === 'yes' ? 'bg-yes' : 'bg-no'}>
                        {bet.option === 'yes' ? 'Sí' : 'No'}
                      </Badge>
                      {getStatusBadge(bet)}
                    </div>
                    <p className="font-medium mt-2 line-clamp-1">
                      {bet.markets?.title || 'Mercado'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(bet.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-xs text-muted-foreground">Apostado</p>
                    <p className="font-display font-bold">
                      ${Number(bet.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                    {bet.is_winner !== null && (() => {
                      const staked = Number(bet.amount) || 0;
                      const payout = bet.is_winner ? Number(bet.payout_amount) || 0 : 0;
                      const profit = payout - staked;
                      const pct = staked > 0 ? (profit / staked) * 100 : 0;
                      const positive = profit >= 0;
                      return (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            Recibido: ${payout.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </p>
                          <p className={`text-sm font-semibold ${positive ? 'text-success' : 'text-destructive'}`}>
                            {positive ? '+' : '-'}$
                            {Math.abs(profit).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </p>
                          <p className={`text-xs font-medium ${positive ? 'text-success' : 'text-destructive'}`}>
                            {positive ? '+' : ''}
                            {pct.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              No has realizado ninguna apuesta todavía.
            </p>
            <Link to="/markets">
              <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                Explorar mercados
              </button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
