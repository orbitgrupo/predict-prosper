import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useUserBets } from '@/hooks/useMarkets';
import { SuggestMarketDialog } from '@/components/dashboard/SuggestMarketDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, Clock, ArrowRight, Loader2, Trophy, Target } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const { data: bets, isLoading: betsLoading } = useUserBets(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const activeBets = bets?.filter(bet => bet.is_winner === null) || [];
  const completedBets = bets?.filter(bet => bet.is_winner !== null) || [];
  const wonBets = completedBets.filter(bet => bet.is_winner);
  const totalWinnings = wonBets.reduce((acc, bet) => acc + Number(bet.payout_amount || 0), 0);
  const totalBetAmount = bets?.reduce((acc, bet) => acc + Number(bet.amount), 0) || 0;
  const winRate = completedBets.length > 0 
    ? (wonBets.length / completedBets.length) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">
            Hola, {profile.username || 'Usuario'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Aquí está el resumen de tu actividad.
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className="font-display text-2xl font-bold">
                    ${profile.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <Trophy className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ganancias</p>
                  <p className="font-display text-2xl font-bold text-success">
                    +${totalWinnings.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                  <Target className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasa de acierto</p>
                  <p className="font-display text-2xl font-bold">
                    {winRate.toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <TrendingUp className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total apostado</p>
                  <p className="font-display text-2xl font-bold">
                    ${totalBetAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active bets */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Apuestas activas</CardTitle>
            <div className="flex gap-2">
              <SuggestMarketDialog userId={user.id} userBalance={profile.balance} />
              <Link to="/markets">
                <Button variant="outline" size="sm" className="gap-2">
                  Nueva apuesta
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {betsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeBets.length > 0 ? (
              <div className="space-y-4">
                {activeBets.slice(0, 5).map((bet: any) => (
                  <Link 
                    key={bet.id} 
                    to={`/market/${bet.market_id}`}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Badge className={bet.option === 'yes' ? 'bg-yes' : bet.option === 'no' ? 'bg-no' : 'bg-primary'}>
                        {bet.option === 'yes' ? 'Sí' : bet.option === 'no' ? 'No' : bet.option}
                      </Badge>
                      <div>
                        <p className="font-medium line-clamp-1">
                          {bet.markets?.title || 'Mercado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(bet.created_at), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${Number(bet.amount).toFixed(2)}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Pendiente
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  No tienes apuestas activas.
                </p>
                <Link to="/markets">
                  <Button className="mt-4">Explorar mercados</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed bets */}
        {completedBets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Historial de apuestas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {completedBets.slice(0, 10).map((bet: any) => (
                  <Link 
                    key={bet.id} 
                    to={`/market/${bet.market_id}`}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Badge className={bet.option === 'yes' ? 'bg-yes' : bet.option === 'no' ? 'bg-no' : 'bg-primary'}>
                        {bet.option === 'yes' ? 'Sí' : bet.option === 'no' ? 'No' : bet.option}
                      </Badge>
                      <div>
                        <p className="font-medium line-clamp-1">
                          {bet.markets?.title || 'Mercado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(bet.created_at), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${bet.is_winner ? 'text-success' : 'text-muted-foreground'}`}>
                        {bet.is_winner 
                          ? `+$${Number(bet.payout_amount).toFixed(2)}` 
                          : `-$${Number(bet.amount).toFixed(2)}`}
                      </p>
                      <Badge variant={bet.is_winner ? 'default' : 'secondary'} className="text-xs">
                        {bet.is_winner ? 'Ganada' : 'Perdida'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
