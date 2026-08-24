import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { usePlaceBet, Market } from '@/hooks/useMarkets';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Star } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useEconomy } from '@/hooks/useEconomy';

interface BettingPanelProps {
  market: Market;
}

type OptionLike = { id: string; option_name: string; total_amount: number };

export function BettingPanel({ market }: BettingPanelProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [isRestrictedLocation, setIsRestrictedLocation] = useState<boolean>(false);
  const [checkingLocation, setCheckingLocation] = useState(true);
  const { user, profile, refreshProfile } = useAuth();
  const placeBet = usePlaceBet();
  const navigate = useNavigate();
  const { formatAmount, isRealMoney } = useEconomy();

  useEffect(() => {
    const checkLocation = async () => {
      try {
        const { data: settings, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 'default')
          .single();
        if (error) throw error;

        if (settings.us_betting_enabled) {
          setIsRestrictedLocation(false);
          return;
        }

        const response = await fetch('https://ipapi.co/json/');
        const data: { country_code?: string; country?: string; country_name?: string } = await response.json();
        setIsRestrictedLocation(
          data.country_code === 'US' || data.country === 'US' || data.country_name === 'United States'
        );
      } catch (error) {
        console.error('Error checking betting restrictions:', error);
        setIsRestrictedLocation(true);
      } finally {
        setCheckingLocation(false);
      }
    };
    checkLocation();
  }, []);

  const hasOptions = market.options && market.options.length > 0;
  const options: OptionLike[] = hasOptions 
    ? market.options.map(o => ({ id: o.id, option_name: o.option_name, total_amount: Number(o.total_amount) }))
    : [
        { id: 'yes', option_name: 'Sí', total_amount: Number(market.total_yes_amount) },
        { id: 'no', option_name: 'No', total_amount: Number(market.total_no_amount) }
      ];

  const totalVolume = options.reduce((sum, opt) => sum + opt.total_amount, 0);
  const hasBets = totalVolume > 0;
  const favoriteOption = market.favorite_option;
  const favoriteProbability = market.favorite_probability || 50;

  const betAmount = parseFloat(amount) || 0;
  const potentialPayout = selectedOption 
    ? calculatePotentialPayout(betAmount, selectedOption, options)
    : 0;

  function calculatePotentialPayout(amount: number, optionName: string, opts: OptionLike[]) {
    const selectedOpt = opts.find(o => o.option_name === optionName);
    if (!selectedOpt) return 0;

    // When no bets exist, use favorite probability to set implied odds
    if (!hasBets && favoriteOption && options.length === 2) {
      const prob = optionName === favoriteOption
        ? favoriteProbability / 100
        : (100 - favoriteProbability) / 100;
      // Payout = stake / probability (lower payout for favorites)
      return amount / prob;
    }
    
    const currentTotal = selectedOpt.total_amount;
    const newTotal = currentTotal + amount;
    const loserPool = totalVolume - currentTotal;
    const winShare = newTotal > 0 ? amount / newTotal : 0;
    
    return amount + (loserPool * winShare);
  }

  const handlePlaceBet = async () => {
    if (!user || !selectedOption) return;

    // Validación robusta del monto
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || !isFinite(parsed)) return;

    // Máximo 2 decimales para evitar fracciones de centavo
    const roundedAmount = Math.round(parsed * 100) / 100;
    if (roundedAmount < 1) return; // Mínimo $1
    if (profile && roundedAmount > profile.balance) return;

    await placeBet.mutateAsync({
      marketId: market.id,
      userId: user.id,
      option: selectedOption,
      amount: roundedAmount,
    });

    setAmount('');
    setSelectedOption(null);
    refreshProfile();
  };

  const isExpired = new Date(market.closes_at) <= new Date();
  const isClosed = market.status !== 'active' || isExpired;

  if (isClosed) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            {isExpired && market.status === 'active'
              ? 'Este mercado ha expirado y ya no acepta apuestas.'
              : 'Este mercado ya no acepta apuestas.'}
          </p>
          {market.resolved_option && (
            <p className="mt-2 font-medium">
              Resultado: <span className={market.resolved_option === 'yes' ? 'text-yes' : 'text-no'}>
                {market.resolved_option === 'yes' ? 'Sí' : 'No'}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="mb-4 text-muted-foreground">
            Inicia sesión para apostar
          </p>
          <Button onClick={() => navigate('/auth')}>
            Iniciar sesión
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!user.email_confirmed_at) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="mb-2 font-medium">Email no confirmado</p>
          <p className="text-sm text-muted-foreground">
            Confirma tu email para poder realizar apuestas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Realizar apuesta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Option buttons */}
        <div className={`grid gap-3 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {options.map((option) => {
            const percentage = hasBets 
              ? (option.total_amount / totalVolume) * 100 
              : (favoriteOption && options.length === 2)
                ? (option.option_name === favoriteOption ? favoriteProbability : 100 - favoriteProbability)
                : 100 / options.length;
            const isYes = option.option_name.toLowerCase() === 'sí' || option.option_name.toLowerCase() === 'yes';
            const isNo = option.option_name.toLowerCase() === 'no';
            const isFavorite = option.option_name === favoriteOption;
            
            return (
              <Button
                key={option.id}
                variant={selectedOption === option.option_name ? 'default' : 'outline'}
                className={`h-16 flex-col gap-1 relative ${
                  selectedOption === option.option_name
                    ? isYes
                      ? 'bg-yes hover:bg-yes/90 text-yes-foreground'
                      : isNo
                      ? 'bg-no hover:bg-no/90 text-no-foreground'
                      : ''
                    : isYes
                    ? 'hover:border-yes hover:text-yes'
                    : isNo
                    ? 'hover:border-no hover:text-no'
                    : ''
                } ${isFavorite ? 'border-warning/50' : ''}`}
                onClick={() => setSelectedOption(option.option_name)}
              >
                {isFavorite && (
                  <Star className="absolute top-1 right-1 h-3.5 w-3.5 fill-warning text-warning" />
                )}
                <span className="text-lg font-bold">{option.option_name}</span>
                <span className="text-xs opacity-80">{percentage.toFixed(1)}%</span>
              </Button>
            );
          })}
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Cantidad</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{isRealMoney ? '\u0024' : 'pts'}</span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={isRealMoney ? 'pl-7' : 'pl-11'}
              min="1"
              max={profile?.balance ?? undefined}
              step="0.01"
            />
          </div>
          {profile && (
            <p className="text-xs text-muted-foreground">
              Saldo disponible: {formatAmount(profile.balance)} · Mínimo {formatAmount(1, 0)}
            </p>
          )}
          {amount && parseFloat(amount) > 0 && parseFloat(amount) < 1 && (
            <p className="text-xs text-destructive">El monto mínimo es {formatAmount(1, 0)}</p>
          )}
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2">
          {[10, 25, 50, 100].map((quickAmount) => (
            <Button
              key={quickAmount}
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setAmount(quickAmount.toString())}
            >
              {formatAmount(quickAmount, 0)}
            </Button>
          ))}
        </div>

        {/* Risk indicator */}
        {selectedOption && (
          <div className="flex items-center justify-center gap-2 py-2">
            {selectedOption === favoriteOption ? (
              <>
                <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                  Menor riesgo
                </Badge>
                <span className="text-xs text-muted-foreground">Pago más bajo pero más probable</span>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                  Mayor riesgo
                </Badge>
                <span className="text-xs text-muted-foreground">Pago más alto pero menos probable</span>
              </>
            )}
          </div>
        )}

        {/* Potential payout */}
        {selectedOption && betAmount > 0 && (
          <div className="rounded-lg bg-secondary p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pago potencial</span>
              <span className="font-bold text-success">
                {formatAmount(potentialPayout)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Si gana "{selectedOption}"</span>
              <span>+{((potentialPayout / betAmount - 1) * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Place bet button */}
        {checkingLocation ? (
          <Button className="w-full" size="lg" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verificando disponibilidad...
          </Button>
        ) : isRestrictedLocation ? (
          <Alert variant="destructive" className="mt-4 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Por restricciones legales, las apuestas no están permitidas desde Estados Unidos.
            </AlertDescription>
          </Alert>
        ) : (
          <Button
            className="w-full"
            size="lg"
            disabled={!selectedOption || betAmount < 1 || placeBet.isPending || (profile && betAmount > profile.balance)}
            onClick={handlePlaceBet}
          >
            {placeBet.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              'Confirmar apuesta'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
