import { useParams, Link } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { EmailConfirmationBanner } from '@/components/layout/EmailConfirmationBanner';
import { BettingPanel } from '@/components/markets/BettingPanel';
import { MarketCharts } from '@/components/markets/MarketCharts';
import { CashoutButton } from '@/components/markets/CashoutButton';
import { useMarket, useUserBets } from '@/hooks/useMarkets';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, TrendingUp, Users, Loader2, ImageIcon, Info } from 'lucide-react';
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

  type OptionLike = { id: string; option_name: string; total_amount: number };
  
  const hasOptions = market.options && market.options.length > 0;
  const options: OptionLike[] = hasOptions 
    ? market.options.map(o => ({ id: o.id, option_name: o.option_name, total_amount: Number(o.total_amount) }))
    : [
        { id: 'yes', option_name: 'Sí', total_amount: Number(market.total_yes_amount) },
        { id: 'no', option_name: 'No', total_amount: Number(market.total_no_amount) }
      ];
  
  const totalVolume = options.reduce((sum, opt) => sum + opt.total_amount, 0);
  const topOption = options.reduce((max, opt) => 
    opt.total_amount > max.total_amount ? opt : max, options[0]);
  const topPercentage = totalVolume > 0 
    ? (topOption?.total_amount || 0) / totalVolume * 100 
    : 0;
  
  const isExpired = new Date(market.closes_at) < new Date();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <EmailConfirmationBanner />
      
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <Link to="/markets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6">
          <ArrowLeft className="h-4 w-4" />
          Volver a mercados
        </Link>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Market image */}
            {market.image_url ? (
              <div className="aspect-[16/9] w-full overflow-hidden rounded-xl">
                <img 
                  src={market.image_url} 
                  alt={market.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-[16/9] w-full bg-muted rounded-xl flex items-center justify-center">
                <ImageIcon className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/40" />
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
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
              
              <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold">
                {market.title}
              </h1>
              
              {market.description && (
                <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground">
                  {market.description}
                </p>
              )}
            </div>

            {/* Mobile betting panel */}
            <div className="lg:hidden">
              <BettingPanel market={market} />
            </div>

            {/* Market Charts */}
            <MarketCharts marketId={market.id} options={options} />

            {/* Probability chart */}
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Probabilidad actual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="space-y-2">
                  {options.map((option) => {
                    const percentage = totalVolume > 0 
                      ? (option.total_amount / totalVolume) * 100 
                      : 100 / options.length;
                    const isYes = option.option_name.toLowerCase() === 'sí' || option.option_name.toLowerCase() === 'yes';
                    const isNo = option.option_name.toLowerCase() === 'no';
                    
                    return (
                      <div key={option.id} className="space-y-1">
                        <div className="flex justify-between text-sm font-medium">
                          <span className={isYes ? 'text-yes' : isNo ? 'text-no' : ''}>
                            {option.option_name}
                          </span>
                          <span className="font-bold">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-secondary">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              isYes ? 'bg-yes' : isNo ? 'bg-no' : 'bg-primary'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Card>
                <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-xs text-muted-foreground">Volumen</p>
                      <p className="font-display text-sm sm:text-xl font-bold">
                        ${totalVolume.toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="text-center sm:text-left min-w-0">
                      <p className="text-xs text-muted-foreground">Líder</p>
                      <p className="font-display text-sm sm:text-xl font-bold truncate">
                        {topOption?.option_name} ({topPercentage.toFixed(0)}%)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-success/10 shrink-0">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-xs text-muted-foreground">Opciones</p>
                      <p className="font-display text-sm sm:text-xl font-bold">
                        {options.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User bets */}
            {marketBets.length > 0 && (
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-base sm:text-lg">Tus apuestas</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="space-y-3">
                    {marketBets.map((bet) => (
                      <div 
                        key={bet.id}
                        className="flex items-center justify-between rounded-lg bg-secondary p-3 sm:p-4 gap-3"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <Badge 
                            className={`shrink-0 text-xs ${
                              bet.option.toLowerCase() === 'yes' || bet.option.toLowerCase() === 'sí'
                                ? 'bg-yes'
                                : bet.option.toLowerCase() === 'no'
                                ? 'bg-no'
                                : ''
                            }`}
                          >
                            {bet.option}
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">${Number(bet.amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(bet.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                            </p>
                          </div>
                        </div>
                        {bet.is_winner !== null ? (
                          <Badge variant={bet.is_winner ? 'default' : 'secondary'} className="shrink-0 text-xs">
                            {bet.is_winner ? `+$${Number(bet.payout_amount).toFixed(2)}` : bet.payout_amount ? `Retirado: $${Number(bet.payout_amount).toFixed(2)}` : 'Perdida'}
                          </Badge>
                        ) : (
                          <CashoutButton
                            bet={{
                              id: bet.id,
                              option: bet.option,
                              amount: Number(bet.amount),
                              potential_payout: bet.potential_payout ? Number(bet.potential_payout) : null,
                              is_winner: bet.is_winner,
                            }}
                            marketOptions={options}
                            marketStatus={market.status}
                            marketClosesAt={market.closes_at}
                            allowCashout={market.allow_cashout ?? true}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info */}
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 sm:px-6">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground shrink-0">Cierra:</span>
                  <span className="truncate">
                    {format(new Date(market.closes_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground shrink-0">Restante:</span>
                  <span>
                    {isExpired 
                      ? 'Expirado' 
                      : formatDistanceToNow(new Date(market.closes_at), { locale: es })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              <BettingPanel market={market} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
