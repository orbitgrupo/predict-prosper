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

export function BettingPanel({ market }: BettingPanelProps) {
  const [selectedOption, setSelectedOption] = useState<'yes' | 'no' | null>(null);
  const [amount, setAmount] = useState('');
  const { user, profile, refreshProfile } = useAuth();
  const placeBet = usePlaceBet();
  const navigate = useNavigate();

  const totalVolume = Number(market.total_yes_amount) + Number(market.total_no_amount);
  const yesPercentage = totalVolume > 0 
    ? (Number(market.total_yes_amount) / totalVolume) * 100 
    : 50;
  const noPercentage = 100 - yesPercentage;

  const betAmount = parseFloat(amount) || 0;
  const potentialPayout = selectedOption 
    ? calculatePotentialPayout(betAmount, selectedOption, market)
    : 0;

  function calculatePotentialPayout(amount: number, option: 'yes' | 'no', market: Market) {
    const yesTotal = Number(market.total_yes_amount);
    const noTotal = Number(market.total_no_amount);
    
    if (option === 'yes') {
      const newYesTotal = yesTotal + amount;
      const loserPool = noTotal;
      const winShare = amount / newYesTotal;
      return amount + (loserPool * winShare);
    } else {
      const newNoTotal = noTotal + amount;
      const loserPool = yesTotal;
      const winShare = amount / newNoTotal;
      return amount + (loserPool * winShare);
    }
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
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={selectedOption === 'yes' ? 'default' : 'outline'}
            className={`h-16 flex-col gap-1 ${
              selectedOption === 'yes' 
                ? 'bg-yes hover:bg-yes/90 text-yes-foreground' 
                : 'hover:border-yes hover:text-yes'
            }`}
            onClick={() => setSelectedOption('yes')}
          >
            <span className="text-lg font-bold">Sí</span>
            <span className="text-xs opacity-80">{yesPercentage.toFixed(1)}%</span>
          </Button>
          <Button
            variant={selectedOption === 'no' ? 'default' : 'outline'}
            className={`h-16 flex-col gap-1 ${
              selectedOption === 'no' 
                ? 'bg-no hover:bg-no/90 text-no-foreground' 
                : 'hover:border-no hover:text-no'
            }`}
            onClick={() => setSelectedOption('no')}
          >
            <span className="text-lg font-bold">No</span>
            <span className="text-xs opacity-80">{noPercentage.toFixed(1)}%</span>
          </Button>
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
              <span>Si gana "{selectedOption === 'yes' ? 'Sí' : 'No'}"</span>
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
