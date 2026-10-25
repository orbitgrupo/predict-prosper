import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { usePlaceBet, Market } from '@/hooks/useMarkets';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Star, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface BettingPanelProps {
  market: Market;
}

type OptionLike = { id: string; option_name: string; total_amount: number };

export function BettingPanel({ market }: BettingPanelProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [isRestrictedLocation, setIsRestrictedLocation] = useState<boolean>(false);
  const { user, profile, refreshProfile } = useAuth();
  const placeBet = usePlaceBet();
  const navigate = useNavigate();

  useEffect(() => {
    const checkLocation = async () => {
      try {
        // Verificar si el bloqueo de EE. UU. está activo en la configuración global
        const { data: settings } = await supabase
          .from('app_settings')
          .select('us_betting_blocked')
          .eq('id', 'default')
          .maybeSingle();

        if ((settings as any)?.us_betting_blocked === false) {
          setIsRestrictedLocation(false);
          return;
        }

        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.country_code === 'US' || data.country === 'US' || data.country_name === 'United States') {
          setIsRestrictedLocation(true);
        }
      } catch (error) {
        console.error('Error checking location:', error);
      }
    };
    checkLocation();
  }, []);

  const isLottery = market.category === 'Lotería';
  const hasOptions = market.options && market.options.length > 0;
  const options: OptionLike[] = hasOptions 
    ? market.options.map(o => ({ id: o.id, option_name: o.option_name, total_amount: Number(o.total_amount) }))
    : [
        { id: 'yes', option_name: 'Sí', total_amount: Number(market.total_yes_amount) },
        { id: 'no', option_name: 'No', total_amount: Number(market.total_no_amount) }
      ];

  const totalVolume = options.reduce((sum, opt) => sum + opt.total_amount, 0);
  const hasBets = totalVolume > 0;
  const favoriteOption = (market as any).favorite_option as string | null;
  const favoriteProbability = (market as any).favorite_probability as number || 50;
  // Lotería: tablero multi-selección (00-99)
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [slipAmount, setSlipAmount] = useState('10');
  const [placingAll, setPlacingAll] = useState(false);
  const selectedNumbers = Object.keys(selections).sort();
  const slipTotal = selectedNumbers.reduce((sum, n) => sum + selections[n], 0);
  const slipPayout = selectedNumbers.reduce((sum, n) => sum + calculatePotentialPayout(selections[n], n, options), 0);

  const fmtMoney = (v: number) => (Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`);

  // Tocar un número lo juega con el monto actual; tocarlo de nuevo le aumenta el monto.
  const handleBoardTap = (num: string) => {
    const step = Math.round((parseFloat(slipAmount) || 0) * 100) / 100;
    if (step < 1) return;
    setSelections((prev) => ({ ...prev, [num]: Math.round(((prev[num] ?? 0) + step) * 100) / 100 }));
  };

  const adjustSelection = (num: string, delta: number) => {
    setSelections((prev) => {
      const next = { ...prev };
      const v = Math.round(((next[num] ?? 0) + delta) * 100) / 100;
      if (v < 1) delete next[num];
      else next[num] = v;
      return next;
    });
  };

  const removeSelection = (num: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[num];
      return next;
    });
  };

  // Juega todos los números de la boleta, uno por uno, con su propio monto.
  const handleConfirmAll = async () => {
    if (!user || selectedNumbers.length === 0 || placingAll) return;
    if (profile && slipTotal > profile.balance) return;
    setPlacingAll(true);
    const done: string[] = [];
    let failed: string | null = null;
    for (const num of selectedNumbers) {
      const { data, error } = await supabase.rpc('place_bet', {
        p_user_id: user.id,
        p_market_id: market.id,
        p_option: num,
        p_amount: selections[num],
      });
      const result = data as { success: boolean; error?: string } | null;
      if (error || !result?.success) {
        failed = error?.message || result?.error || 'Error al realizar la predicción';
        break;
      }
      done.push(num);
    }
    if (done.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      queryClient.invalidateQueries({ queryKey: ['bets'] });
      refreshProfile();
      setSelections((prev) => {
        const next = { ...prev };
        done.forEach((n) => delete next[n]);
        return next;
      });
    }
    if (failed) {
      toast({
        title: done.length > 0 ? 'Jugada parcial' : 'Error',
        description: done.length > 0 ? `Jugados: ${done.join(', ')}. Falló el resto: ${failed}` : failed,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Predicciones realizadas',
        description: `${done.length} ${done.length === 1 ? 'número jugado' : 'números jugados'} por $${slipTotal.toFixed(2)}.`,
      });
    }
    setPlacingAll(false);
  };

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
              ? 'Este mercado ha expirado y ya no acepta predicciones.'
              : 'Este mercado ya no acepta predicciones.'}
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
            Confirma tu email para poder realizar predicciones.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{isLottery ? 'Tablero de números' : 'Realizar predicción'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLottery ? (
          <>
            {/* Monto por número */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Monto por número</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={slipAmount}
                  onChange={(e) => setSlipAmount(e.target.value)}
                  placeholder="10.00"
                  className="pl-7"
                  min="1"
                  step="0.01"
                />
              </div>
              <div className="flex gap-2">
                {[5, 10, 25, 50].map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant={slipAmount === quickAmount.toString() ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setSlipAmount(quickAmount.toString())}
                  >
                    ${quickAmount}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Toca un número para jugarlo con este monto. Tócalo de nuevo para aumentarle el monto.
              </p>
            </div>

            {/* Tablero 10x10 */}
            <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
              {options.map((option) => {
                const amt = selections[option.option_name];
                const isSelected = amt != null;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleBoardTap(option.option_name)}
                    className={`flex aspect-square flex-col items-center justify-center rounded-full text-white transition-all ${isSelected ? 'bg-green-600 ring-2 ring-green-700 ring-offset-2 ring-offset-background scale-105' : 'bg-black hover:bg-neutral-800'}`}
                  >
                    <span className="text-xs sm:text-sm font-bold leading-none">{option.option_name}</span>
                    {isSelected && (
                      <span className="mt-0.5 text-[8px] sm:text-[9px] leading-none opacity-90">{fmtMoney(amt)}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Boleta */}
            {selectedNumbers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tus números ({selectedNumbers.length})</span>
                  <button type="button" onClick={() => setSelections({})} className="text-xs text-muted-foreground underline">
                    Limpiar
                  </button>
                </div>
                <div className="space-y-1.5">
                  {selectedNumbers.map((num) => (
                    <div key={num} className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">{num}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => adjustSelection(num, -1)}>
                          -
                        </Button>
                        <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums">${selections[num].toFixed(2)}</span>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => adjustSelection(num, 1)}>
                          +
                        </Button>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground">
                        Gana ${calculatePotentialPayout(selections[num], num, options).toFixed(2)}
                      </span>
                      <button type="button" onClick={() => removeSelection(num)} className="text-muted-foreground hover:text-destructive" aria-label={`Quitar ${num}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 rounded-lg bg-secondary p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total a jugar</span>
                    <span className="font-bold">${slipTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Para ganar</span>
                    <span className="text-2xl font-black text-green-600 dark:text-green-400">${slipPayout.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmar jugada */}
            <Button
              className="w-full"
              size="lg"
              disabled={selectedNumbers.length === 0 || placingAll || (profile != null && slipTotal > profile.balance)}
              onClick={handleConfirmAll}
            >
              {placingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Jugando...
                </>
              ) : selectedNumbers.length === 0 ? (
                'Elige tus números'
              ) : (
                `Confirmar ${selectedNumbers.length} ${selectedNumbers.length === 1 ? 'número' : 'números'} · $${slipTotal.toFixed(2)}`
              )}
            </Button>
            {profile && slipTotal > profile.balance && (
              <p className="text-center text-xs text-destructive">
                El total supera tu saldo disponible (${profile.balance.toFixed(2)}).
              </p>
            )}
          </>
        ) : (
          <>
        {/* Option buttons */}
        <div className={`grid ${isLottery ? 'grid-cols-5 sm:grid-cols-10 gap-2' : `gap-3 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}`}>
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
                className={`${isLottery ? 'h-12 flex-col gap-0' : 'h-16 flex-col gap-1'} relative ${
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
                <span className={isLottery ? 'text-base font-bold leading-tight' : 'text-lg font-bold'}>{option.option_name}</span>
                <span className={isLottery ? 'text-[10px] leading-tight opacity-80' : 'text-xs opacity-80'}>{percentage.toFixed(1)}%</span>
              </Button>
            );
          })}
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Cantidad</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pl-7"
              min="1"
              max={profile?.balance ?? undefined}
              step="0.01"
            />
          </div>
          {profile && (
            <p className="text-xs text-muted-foreground">
              Saldo disponible: ${profile.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })} · Mínimo $1
            </p>
          )}
          {amount && parseFloat(amount) > 0 && parseFloat(amount) < 1 && (
            <p className="text-xs text-destructive">El monto mínimo de predicción es $1</p>
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
              ${quickAmount}
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

        {/* To win (estilo Polymarket) */}
        {selectedOption && betAmount > 0 && (
          <div className="rounded-lg bg-secondary p-3 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Para ganar</span>
              <span className="text-2xl font-black text-green-600 dark:text-green-400">
                ${potentialPayout.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Precio prom. {potentialPayout > 0 ? ((betAmount / potentialPayout) * 100).toFixed(2) : '--'}&cent;
              </span>
              <span>+{((potentialPayout / betAmount - 1) * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Place bet button */}
        {isRestrictedLocation ? (
          <Alert variant="destructive" className="mt-4 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Por restricciones legales, las predicciones no están permitidas desde Estados Unidos.
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
              'Confirmar predicción'
            )}
          </Button>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
