import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { EmailConfirmationBanner } from '@/components/layout/EmailConfirmationBanner';
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
  const { user, profile, loading, isEmailConfirmed } = useAuth();
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
      <EmailConfirmationBanner />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            Hola, {profile.username || 'Usuario'}
          </h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-muted-foreground">
            Aquí está el resumen de tu actividad.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-6 sm:mb-8">
          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Saldo</p>
                  <p className="font-display text-lg sm:text-2xl font-bold">
                    ${profile.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-success/10 shrink-0">
                  <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Ganancias</p>
                  <p className="font-display text-lg sm:text-2xl font-bold text-success">
                    +${totalWinnings.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-warning/10 shrink-0">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Acierto</p>
                  <p className="font-display text-lg sm:text-2xl font-bold">
                    {winRate.toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-muted shrink-0">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Apostado</p>
                  <p className="font-display text-lg sm:text-2xl font-bold">
                    ${totalBetAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active bets */}
        <Card className="mb-6 sm:mb-8">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Apuestas activas</CardTitle>
            <div className="flex gap-2">
              {isEmailConfirmed && (
                <SuggestMarketDialog userId={user.id} userBalance={profile.balance} />
              )}
              <Link to="/markets">
                <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                  {isEmailConfirmed ? 'Nueva apuesta' : 'Ver mercados'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {betsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeBets.length > 0 ? (
              <div className="space-y-3">
                {activeBets.slice(0, 5).map((bet: any) => (
                  <Link 
                    key={bet.id} 
                    to={`/market/${bet.market_id}`}
                    className="flex items-center justify-between rounded-lg border p-3 sm:p-4 hover:bg-secondary/50 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                      <Badge className={`shrink-0 text-xs ${bet.option === 'yes' ? 'bg-yes' : bet.option === 'no' ? 'bg-no' : 'bg-primary'}`}>
                        {bet.option === 'yes' ? 'Sí' : bet.option === 'no' ? 'No' : bet.option}
                      </Badge>
                      <div className="min-w-0">
                        <p className="font-medium text-sm line-clamp-1">
                          {bet.markets?.title || 'Mercado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(bet.created_at), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium text-sm">${Number(bet.amount).toFixed(2)}</p>
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
                <p className="mt-4 text-sm text-muted-foreground">No tienes apuestas activas.</p>
                <Link to="/markets">
                  <Button className="mt-4" size="sm">Explorar mercados</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed bets */}
        {completedBets.length > 0 && (
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Historial de apuestas</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-3">
                {completedBets.slice(0, 10).map((bet: any) => (
                  <Link 
                    key={bet.id} 
                    to={`/market/${bet.market_id}`}
                    className="flex items-center justify-between rounded-lg border p-3 sm:p-4 hover:bg-secondary/50 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                      <Badge className={`shrink-0 text-xs ${bet.option === 'yes' ? 'bg-yes' : bet.option === 'no' ? 'bg-no' : 'bg-primary'}`}>
                        {bet.option === 'yes' ? 'Sí' : bet.option === 'no' ? 'No' : bet.option}
                      </Badge>
                      <div className="min-w-0">
                        <p className="font-medium text-sm line-clamp-1">
                          {bet.markets?.title || 'Mercado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(bet.created_at), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-medium text-sm ${bet.is_winner ? 'text-success' : 'text-muted-foreground'}`}>
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
