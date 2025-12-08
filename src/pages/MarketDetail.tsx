import { useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { BettingPanel } from '@/components/markets/BettingPanel';
import { useMarket, useUserBets } from '@/hooks/useMarkets';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, TrendingUp, Users, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: market, isLoading } = useMarket(id || '');
  const { user } = useAuth();
  const { data: userBets } = useUserBets(user?.id);

  const marketBets = userBets?.filter(bet => bet.market_id === id) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Mercado no encontrado</h1>
          <p className="mt-2 text-muted-foreground">
            El mercado que buscas no existe o ha sido eliminado.
          </p>
          <Link to="/markets">
            <Button className="mt-6">Volver a mercados</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalVolume = Number(market.total_yes_amount) + Number(market.total_no_amount);
  const yesPercentage = totalVolume > 0 
    ? (Number(market.total_yes_amount) / totalVolume) * 100 
    : 50;
  const noPercentage = 100 - yesPercentage;
  const isExpired = new Date(market.closes_at) < new Date();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <Link to="/markets" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Volver a mercados
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {market.category && (
                  <Badge variant="outline">{market.category}</Badge>
                )}
                <Badge 
                  variant={market.status === 'active' && !isExpired ? 'default' : 'secondary'}
                >
                  {market.status === 'resolved' 
                    ? 'Resuelto' 
                    : market.status === 'closed' 
                      ? 'Cerrado' 
                      : isExpired 
                        ? 'Expirado' 
                        : 'Activo'}
                </Badge>
              </div>
              
              <h1 className="font-display text-2xl font-bold lg:text-3xl">
                {market.title}
              </h1>
              
              {market.description && (
                <p className="mt-4 text-muted-foreground">
                  {market.description}
                </p>
              )}
            </div>

            {/* Probability chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Probabilidad actual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-yes">Sí {yesPercentage.toFixed(1)}%</span>
                  <span className="text-no">No {noPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex h-6 overflow-hidden rounded-full bg-secondary">
                  <div 
                    className="bg-yes transition-all duration-500 flex items-center justify-center text-xs font-medium text-yes-foreground"
                    style={{ width: `${yesPercentage}%` }}
                  >
                    {yesPercentage > 15 && `${yesPercentage.toFixed(0)}%`}
                  </div>
                  <div 
                    className="bg-no transition-all duration-500 flex items-center justify-center text-xs font-medium text-no-foreground"
                    style={{ width: `${noPercentage}%` }}
                  >
                    {noPercentage > 15 && `${noPercentage.toFixed(0)}%`}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Volumen total</p>
                      <p className="font-display text-xl font-bold">
                        ${totalVolume.toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yes/10">
                      <Users className="h-5 w-5 text-yes" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Apuestas "Sí"</p>
                      <p className="font-display text-xl font-bold">
                        ${Number(market.total_yes_amount).toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-no/10">
                      <Users className="h-5 w-5 text-no" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Apuestas "No"</p>
                      <p className="font-display text-xl font-bold">
                        ${Number(market.total_no_amount).toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User bets */}
            {marketBets.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tus apuestas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {marketBets.map((bet) => (
                      <div 
                        key={bet.id}
                        className="flex items-center justify-between rounded-lg bg-secondary p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Badge 
                            className={bet.option === 'yes' ? 'bg-yes' : 'bg-no'}
                          >
                            {bet.option === 'yes' ? 'Sí' : 'No'}
                          </Badge>
                          <div>
                            <p className="font-medium">${Number(bet.amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(bet.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                            </p>
                          </div>
                        </div>
                        {bet.is_winner !== null && (
                          <Badge variant={bet.is_winner ? 'default' : 'secondary'}>
                            {bet.is_winner ? `+$${Number(bet.payout_amount).toFixed(2)}` : 'Perdida'}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cierra:</span>
                  <span>
                    {format(new Date(market.closes_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Tiempo restante:</span>
                  <span>
                    {isExpired 
                      ? 'Expirado' 
                      : formatDistanceToNow(new Date(market.closes_at), { locale: es })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <BettingPanel market={market} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
