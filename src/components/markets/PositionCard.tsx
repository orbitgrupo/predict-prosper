import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePlaceBet, type MarketOption } from '@/hooks/useMarkets';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { calcPositionValue, optionProbability } from '@/lib/cashout';
import { findLidomTeamByName } from '@/data/lidomTeams';
import { teamColor } from './GameMarketView';
import { CashoutButton } from './CashoutButton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Plus, Swords } from 'lucide-react';

interface PositionCardProps {
  bet: {
    id: string;
    market_id: string;
    option: string;
    amount: number;
    potential_payout: number | null;
    is_winner: boolean | null;
    payout_amount: number | null;
    created_at: string;
  };
  marketOptions: { option_name: string; total_amount: number }[];
  marketStatus: string;
  marketClosesAt: string;
  allowCashout: boolean;
}

const initials = (s: string) =>
  s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function PositionCard({ bet, marketOptions, marketStatus, marketClosesAt, allowCashout }: PositionCardProps) {
  const { user, profile, refreshProfile } = useAuth();
  const placeBet = usePlaceBet();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'more' | 'against' | null>(null);
  const [amount, setAmount] = useState('');
  const [againstOption, setAgainstOption] = useState('');

  const stake = Number(bet.amount);
  const potential = bet.potential_payout ? Number(bet.potential_payout) : null;
  const currentPct = optionProbability(bet.option, marketOptions);
  const costPct = potential && potential > 0 ? stake / potential : 0.5;
  const liveValue = calcPositionValue(stake, potential, currentPct);
  const pnl = liveValue - stake;
  const toWin = potential ?? stake * 2;

  const otherOptions = marketOptions.filter((o) => o.option_name !== bet.option);
  const againstDefault = otherOptions.length === 1 ? otherOptions[0].option_name : againstOption;

  const logo = findLidomTeamByName(bet.option);
  const isExpired = new Date(marketClosesAt) <= new Date();
  const active = marketStatus === 'active' && !isExpired && bet.is_winner === null;

  const betAmount = parseFloat(amount) || 0;
  const canAfford = !profile || betAmount <= Number(profile.balance);

  const handleConfirm = async () => {
    if (!user) return;
    const target = mode === 'more' ? bet.option : againstDefault;
    if (!target) return;
    const rounded = Math.round(betAmount * 100) / 100;
    if (rounded < 1 || !canAfford) return;
    await placeBet.mutateAsync({
      marketId: bet.market_id,
      userId: user.id,
      option: target,
      amount: rounded,
    });
    refreshProfile();
    queryClient.invalidateQueries({ queryKey: ['market-options-live', bet.market_id] });
    setMode(null);
    setAmount('');
    setAgainstOption('');
  };

  const openMode = (m: 'more' | 'against') => {
    setAmount('');
    setAgainstOption('');
    setMode(mode === m ? null : m);
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo.logo} alt={bet.option} className="h-10 w-10 rounded-full object-cover bg-white shadow" />
        ) : (
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-black text-white shadow"
            style={{ backgroundColor: teamColor(bet.option, 0) }}
          >
            {initials(bet.option)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">{bet.option}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(bet.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
          </p>
        </div>
        {bet.is_winner !== null && (
          <Badge variant={bet.is_winner ? 'default' : 'secondary'} className="shrink-0">
            {bet.is_winner ? `+$${Number(bet.payout_amount).toFixed(2)}` : 'Perdida'}
          </Badge>
        )}
      </div>

      <div className="border-t border-dashed" />

      {/* Costo / Actual / Por ganar */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Costo {(costPct * 100).toFixed(0)}%</p>
          <p className="text-lg font-bold">${stake.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Actual {(currentPct * 100).toFixed(0)}%</p>
          <p className={`text-lg font-bold ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            ${liveValue.toFixed(2)}{' '}
            <span className="text-xs font-semibold">
              ({pnl >= 0 ? '+' : ''}{pnl.toFixed(2)})
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Por ganar</p>
          <p className="text-lg font-bold">${toWin.toFixed(2)}</p>
        </div>
      </div>

      {active && mode === null && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => openMode('more')} className="gap-1">
              <Plus className="h-4 w-4" /> Agregar más {(currentPct * 100).toFixed(0)}%
            </Button>
            <CashoutButton
              bet={{
                id: bet.id,
                option: bet.option,
                amount: stake,
                potential_payout: potential,
                is_winner: bet.is_winner,
              }}
              marketOptions={marketOptions}
              marketStatus={marketStatus}
              marketClosesAt={marketClosesAt}
              allowCashout={allowCashout}
              triggerClassName="w-full"
            />
          </div>
          {otherOptions.length > 0 && (
            <Button variant="outline" className="w-full gap-1" onClick={() => openMode('against')}>
              <Swords className="h-4 w-4" />
              Apostar en contra{otherOptions.length === 1 ? `: ${otherOptions[0].option_name}` : ''}
            </Button>
          )}
        </div>
      )}

      {active && mode !== null && (
        <div className="space-y-3 rounded-xl bg-muted/50 p-3">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">
              {mode === 'more' ? `Agregar a ${bet.option}` : 'Apostar en contra'}
            </Label>
            {(currentPct * 100).toFixed(0)}%
          </div>
          {mode === 'against' && otherOptions.length > 1 && (
            <Select value={againstOption} onValueChange={setAgainstOption}>
              <SelectTrigger>
                <SelectValue placeholder="Elige el equipo contrario" />
              </SelectTrigger>
              <SelectContent>
                {otherOptions.map((o) => (
                  <SelectItem key={o.option_name} value={o.option_name}>
                    {o.option_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {mode === 'against' && otherOptions.length === 1 && (
            <p className="text-sm font-medium">{otherOptions[0].option_name}</p>
          )}
          <div className="space-y-1">
            <Label htmlFor={`pc-amount-${bet.id}`}>Monto</Label>
            <Input
              id={`pc-amount-${bet.id}`}
              type="number"
              min={1}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {!canAfford && (
              <p className="text-xs text-destructive">Saldo insuficiente.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                placeBet.isPending || betAmount < 1 || !canAfford ||
                (mode === 'against' && !againstDefault)
              }
            >
              {placeBet.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                `Confirmar $${betAmount >= 1 ? betAmount.toFixed(2) : '0.00'}`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
