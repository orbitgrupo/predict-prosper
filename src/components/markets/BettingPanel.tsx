import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { usePlaceBet, Market } from '@/hooks/useMarkets';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface BettingPanelProps {
  market: Market;
}

type OptionLike = { id: string; option_name: string; total_amount: number };

export function BettingPanel({ market }: BettingPanelProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const { user, profile, refreshProfile } = useAuth();
  const placeBet = usePlaceBet();
  const navigate = useNavigate();

  const hasOptions = market.options && market.options.length > 0;
  const options: OptionLike[] = hasOptions 
    ? market.options.map(o => ({ id: o.id, option_name: o.option_name, total_amount: Number(o.total_amount) }))
    : [
        { id: 'yes', option_name: 'Sí', total_amount: Number(market.total_yes_amount) },
        { id: 'no', option_name: 'No', total_amount: Number(market.total_no_amount) }
      ];

  const totalVolume = options.reduce((sum, opt) => sum + opt.total_amount, 0);

  const betAmount = parseFloat(amount) || 0;
  const potentialPayout = selectedOption 
    ? calculatePotentialPayout(betAmount, selectedOption, options)
    : 0;

  function calculatePotentialPayout(amount: number, optionName: string, opts: OptionLike[]) {
    const selectedOpt = opts.find(o => o.option_name === optionName);
    if (!selectedOpt) return 0;
    
    const currentTotal = selectedOpt.total_amount;
    const newTotal = currentTotal + amount;
    const loserPool = totalVolume - currentTotal;
    const winShare = newTotal > 0 ? amount / newTotal : 0;
    
    return amount + (loserPool * winShare);
  }

  const handlePlaceBet = async () => {
    if (!user || !selectedOption || betAmount <= 0) return;

    await placeBet.mutateAsync({
      marketId: market.id,
      userId: user.id,
      option: selectedOption,
      amount: betAmount,
    });

    setAmount('');
    setSelectedOption(null);
    refreshProfile();
  };

  if (market.status !== 'active') {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Este mercado ya no acepta apuestas.
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Realizar apuesta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Option buttons */}
        <div className={`grid gap-3 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {options.map((option) => {
            const percentage = totalVolume > 0 
              ? (option.total_amount / totalVolume) * 100 
              : 100 / options.length;
            const isYes = option.option_name.toLowerCase() === 'sí' || option.option_name.toLowerCase() === 'yes';
            const isNo = option.option_name.toLowerCase() === 'no';
            
            return (
              <Button
                key={option.id}
                variant={selectedOption === option.option_name ? 'default' : 'outline'}
                className={`h-16 flex-col gap-1 ${
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
                }`}
                onClick={() => setSelectedOption(option.option_name)}
              >
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pl-7"
              min="0"
              step="0.01"
            />
          </div>
          {profile && (
            <p className="text-xs text-muted-foreground">
              Saldo disponible: ${profile.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </p>
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

        {/* Potential payout */}
        {selectedOption && betAmount > 0 && (
          <div className="rounded-lg bg-secondary p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pago potencial</span>
              <span className="font-bold text-success">
                ${potentialPayout.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Si gana "{selectedOption}"</span>
              <span>+{((potentialPayout / betAmount - 1) * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Place bet button */}
        <Button
          className="w-full"
          size="lg"
          disabled={!selectedOption || betAmount <= 0 || placeBet.isPending || (profile && betAmount > profile.balance)}
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
      </CardContent>
    </Card>
  );
}
