import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { Market } from '@/hooks/useMarkets';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MarketCardProps {
  market: Market;
}

interface RowOption {
  id: string;
  name: string;
  amount: number;
}

function initial(name: string) {
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : '?';
}

export function MarketCard({ market }: MarketCardProps) {
  const rows: RowOption[] =
    market.options && market.options.length > 0
      ? market.options.map((o) => ({
          id: o.id,
          name: o.option_name,
          amount: Number(o.total_amount),
        }))
      : [
          { id: 'yes', name: 'Sí', amount: Number(market.total_yes_amount) },
          { id: 'no', name: 'No', amount: Number(market.total_no_amount) },
        ];

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const withProb = rows.map((r) => ({
    ...r,
    prob: total > 0 ? r.amount / total : 1 / rows.length,
  }));
  const top = [...withProb].sort((a, b) => b.prob - a.prob).slice(0, 2);

  let closesLabel = '';
  try {
    closesLabel = format(new Date(market.closes_at), "d MMM", { locale: es });
  } catch {
    closesLabel = '';
  }

  return (
    <Link
      to={`/market/${market.id}`}
      className="group flex flex-col rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md sm:p-5"
    >
      {/* Event header */}
      <div className="flex items-start gap-3">
        {market.image_url ? (
          <img
            src={market.image_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:underline">
            {market.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {closesLabel}
            {market.category ? ` · ${market.category}` : ''}
          </p>
        </div>
      </div>

      {/* Outcome rows */}
      <div className="mt-4 space-y-3">
        {top.map((r, i) => (
          <div key={r.id}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {initial(r.name)}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {r.name}
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {r.prob > 0 ? `${(1 / r.prob).toFixed(2)}x` : '—'}
              </span>
              <span
                className={`min-w-[3.5rem] rounded-lg px-2 py-1 text-center text-sm font-semibold tabular-nums ${
                  i === 0 ? 'bg-yes text-white' : 'border text-muted-foreground'
                }`}
              >
                {Math.round(r.prob * 100)}%
              </span>
            </div>
            <div className="ml-[2.375rem] mt-1.5 h-[3px] overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${
                  i === 0 ? 'bg-yes' : 'bg-muted-foreground/50'
                }`}
                style={{ width: `${Math.round(r.prob * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {rows.length} {rows.length === 1 ? 'opción' : 'opciones'}
        </span>
        <span className="tabular-nums">
          ${total.toLocaleString('es-ES')} vol.
        </span>
      </div>
    </Link>
  );
}
