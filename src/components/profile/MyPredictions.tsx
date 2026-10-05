import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserBets } from '@/hooks/useMarkets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Target } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Status = 'pending' | 'won' | 'lost' | 'cashout';
const LABEL: Record<Status, string> = { pending: 'Pendiente', won: 'Ganada', lost: 'Perdida', cashout: 'Retirada' };
const STYLE: Record<Status, string> = {
  pending: 'bg-warning/10 text-warning',
  won: 'bg-success/10 text-success',
  lost: 'bg-destructive/10 text-destructive',
  cashout: 'bg-primary/10 text-primary',
};

const money = (n: number) => `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MyPredictions({ userId }: { userId: string }) {
  const { data: bets, isLoading } = useUserBets(userId);
  const [market, setMarket] = useState('all');
  const [status, setStatus] = useState<'all' | Status>('all');

  const rows = useMemo(() => (bets ?? []).map((b: any) => {
    const staked = Number(b.amount) || 0;
    const st: Status = b.is_winner === null ? 'pending' : b.is_winner ? 'won' : Number(b.payout_amount) > 0 ? 'cashout' : 'lost';
    const received = st === 'pending' ? 0 : Number(b.payout_amount) || 0;
    return { ...b, staked, st, received, profit: st === 'pending' ? 0 : received - staked };
  }), [bets]);

  const markets = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => m.set(r.market_id, r.markets?.title ?? 'Mercado'));
    return [...m.entries()];
  }, [rows]);

  const filtered = rows.filter(r => (market === 'all' || r.market_id === market) && (status === 'all' || r.st === status));
  const settled = filtered.filter(r => r.st !== 'pending');
  const staked = filtered.reduce((s, r) => s + r.staked, 0);
  const gains = settled.filter(r => r.profit > 0).reduce((s, r) => s + r.profit, 0);
  const losses = settled.filter(r => r.profit < 0).reduce((s, r) => s - r.profit, 0);
  const net = gains - losses;

  if (isLoading) return <Card><CardContent className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="text-lg">Mis predicciones</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Invertido', money(staked), ''],
            ['Ganancias', `+${money(gains)}`, 'text-success'],
            ['Pérdidas', `-${money(losses)}`, 'text-destructive'],
            ['Neto', `${net >= 0 ? '+' : '-'}${money(Math.abs(net))}`, net >= 0 ? 'text-success' : 'text-destructive'],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className={`font-display font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={market} onValueChange={setMarket}>
            <SelectTrigger className="sm:flex-1"><SelectValue placeholder="Mercado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los mercados</SelectItem>
              {markets.map(([id, t]) => <SelectItem key={id} value={id}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {(Object.keys(LABEL) as Status[]).map(s => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Target className="mx-auto h-10 w-10 mb-3" />
            No hay predicciones con estos filtros.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <Link key={r.id} to={`/market/${r.market_id}`} className="flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-secondary/50 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{r.option === 'yes' ? 'Sí' : r.option === 'no' ? 'No' : r.option}</Badge>
                    <Badge variant="secondary" className={STYLE[r.st]}>{LABEL[r.st]}</Badge>
                  </div>
                  <p className="font-medium mt-2 line-clamp-1">{r.markets?.title ?? 'Mercado'}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Invertido {money(r.staked)}</p>
                  {r.st === 'pending' ? (
                    <p className="text-sm text-muted-foreground">En juego</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Recibido {money(r.received)}</p>
                      <p className={`font-display font-bold ${r.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {r.profit >= 0 ? '+' : '-'}{money(Math.abs(r.profit))}
                        <span className="ml-1 text-xs">({r.staked > 0 ? ((r.profit / r.staked) * 100).toFixed(1) : 0}%)</span>
                      </p>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
