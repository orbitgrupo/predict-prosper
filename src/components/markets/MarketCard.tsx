import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, ImageIcon } from 'lucide-react';
import { Market } from '@/hooks/useMarkets';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const totalVolume = Number(market.total_yes_amount) + Number(market.total_no_amount);
  const yesPercentage = totalVolume > 0 
    ? (Number(market.total_yes_amount) / totalVolume) * 100 
    : 50;
  const noPercentage = 100 - yesPercentage;

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
              <span className="text-yes">Sí {yesPercentage.toFixed(0)}%</span>
              <span className="text-no">No {noPercentage.toFixed(0)}%</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
              <div 
                className="bg-yes transition-all duration-500"
                style={{ width: `${yesPercentage}%` }}
              />
              <div 
                className="bg-no transition-all duration-500"
                style={{ width: `${noPercentage}%` }}
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
