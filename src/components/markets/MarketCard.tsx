import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, ImageIcon, ShieldCheck, ShieldOff } from 'lucide-react';
import { Market } from '@/hooks/useMarkets';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface MarketCardProps {
  market: Market;
}

type OptionLike = { id: string; option_name: string; total_amount: number };

export function MarketCard({ market }: MarketCardProps) {
  const hasOptions = market.options && market.options.length > 0;
  const options: OptionLike[] = hasOptions 
    ? market.options.map(o => ({ id: o.id, option_name: o.option_name, total_amount: Number(o.total_amount) }))
    : [
        { id: 'yes', option_name: 'Sí', total_amount: Number(market.total_yes_amount) },
        { id: 'no', option_name: 'No', total_amount: Number(market.total_no_amount) }
      ];
  
  const totalVolume = options.reduce((sum, opt) => sum + opt.total_amount, 0);
  const topTwoOptions = [...options]
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 2);
  
  const option1 = topTwoOptions[0];
  const option2 = topTwoOptions[1];
  const option1Percentage = totalVolume > 0 
    ? (option1?.total_amount || 0) / totalVolume * 100 
    : 50;
  const option2Percentage = totalVolume > 0 
    ? (option2?.total_amount || 0) / totalVolume * 100 
    : 50;

  const isExpired = new Date(market.closes_at) < new Date();
  const statusLabel = market.status === 'resolved' 
    ? 'Resuelto' 
    : market.status === 'closed' 
      ? 'Cerrado' 
      : isExpired 
        ? 'Expirado' 
        : 'Activo';

  return (
    <Link to={`/market/${market.id}`}>
      <Card className="group h-full transition-all hover:shadow-lg hover:border-primary/20 overflow-hidden">
        {/* Market image */}
        {market.image_url ? (
          <div className="aspect-[16/9] w-full overflow-hidden">
            <img 
              src={market.image_url} 
              alt={market.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] w-full bg-muted flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-semibold leading-tight group-hover:text-primary transition-colors">
              {market.title}
            </h3>
            <Badge 
              variant={market.status === 'active' && !isExpired ? 'default' : 'secondary'}
              className="shrink-0"
            >
              {statusLabel}
            </Badge>
          </div>
          {market.category && (
            <Badge variant="outline" className="w-fit text-xs">
              {market.category}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {market.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {market.description}
            </p>
          )}

          {/* Probability bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className={option1?.option_name.toLowerCase() === 'sí' || option1?.option_name.toLowerCase() === 'yes' ? 'text-yes' : ''}>
                {option1?.option_name} {option1Percentage.toFixed(0)}%
              </span>
              <span className={option2?.option_name.toLowerCase() === 'no' ? 'text-no' : ''}>
                {option2?.option_name} {option2Percentage.toFixed(0)}%
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
              <div 
                className={`transition-all duration-500 ${
                  option1?.option_name.toLowerCase() === 'sí' || option1?.option_name.toLowerCase() === 'yes'
                    ? 'bg-yes'
                    : 'bg-primary'
                }`}
                style={{ width: `${option1Percentage}%` }}
              />
              <div 
                className={`transition-all duration-500 ${
                  option2?.option_name.toLowerCase() === 'no'
                    ? 'bg-no'
                    : 'bg-secondary-foreground'
                }`}
                style={{ width: `${option2Percentage}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>${totalVolume.toLocaleString('es-ES')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {formatDistanceToNow(new Date(market.closes_at), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
