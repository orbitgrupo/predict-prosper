import { useUserBets } from '@/hooks/useMarkets';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Target, TrendingUp, Percent, Loader2 } from 'lucide-react';

interface ProfileStatsProps {
  userId: string;
}

export function ProfileStats({ userId }: ProfileStatsProps) {
  const { data: bets, isLoading } = useUserBets(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalBets = bets?.length || 0;
  const completedBets = bets?.filter(bet => bet.is_winner !== null) || [];
  const wonBets = completedBets.filter(bet => bet.is_winner);
  const totalWinnings = wonBets.reduce((acc, bet) => acc + Number(bet.payout_amount || 0), 0);
  const totalBetAmount = bets?.reduce((acc, bet) => acc + Number(bet.amount), 0) || 0;
  const winRate = completedBets.length > 0 
    ? (wonBets.length / completedBets.length) * 100 
    : 0;
  const roi = totalBetAmount > 0 
    ? ((totalWinnings - totalBetAmount) / totalBetAmount) * 100 
    : 0;

  const stats = [
    {
      label: 'Total de apuestas',
      value: totalBets.toString(),
      icon: Target,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Apuestas ganadas',
      value: wonBets.length.toString(),
      icon: Trophy,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Tasa de acierto',
      value: `${winRate.toFixed(1)}%`,
      icon: Percent,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'ROI',
      value: `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`,
      icon: TrendingUp,
      color: roi >= 0 ? 'text-success' : 'text-destructive',
      bgColor: roi >= 0 ? 'bg-success/10' : 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`font-display text-xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
