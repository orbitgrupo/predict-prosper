import { useMemo } from 'react';
import { useUserBets } from '@/hooks/useMarkets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

type Row = { label: string; count: number; staked: number; net: number };

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-ES', { maximumFractionDigits: 2 })}`;

function group<T>(items: T[], key: (t: T) => string, order?: string[]) {
  const m = new Map<string, T[]>();
  order?.forEach(k => m.set(k, []));
  items.forEach(i => { const k = key(i); m.set(k, [...(m.get(k) ?? []), i]); });
  return m;
}

function Section({ title, rows, metric }: { title: string; rows: Row[]; metric: 'net' | 'count' }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: number) => (metric === 'net' ? money(v) : v)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey={metric} name={metric === 'net' ? 'Neto' : 'Predicciones'} radius={[4, 4, 0, 0]}>
                {rows.map(r => (
                  <Cell key={r.label} fill={metric === 'count' ? 'hsl(var(--primary))' : r.net >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="divide-y rounded-lg border text-sm">
          <div className="grid grid-cols-4 px-3 py-2 text-xs text-muted-foreground">
            <span>Grupo</span><span className="text-right">Cant.</span><span className="text-right">Invertido</span><span className="text-right">Neto</span>
          </div>
          {rows.map(r => (
            <div key={r.label} className="grid grid-cols-4 px-3 py-2">
              <span className="truncate">{r.label}</span>
              <span className="text-right">{r.count}</span>
              <span className="text-right">{money(r.staked)}</span>
              <span className={`text-right font-semibold ${r.net >= 0 ? 'text-success' : 'text-destructive'}`}>{money(r.net)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PredictionInsights({ userId }: { userId: string }) {
  const { data: bets, isLoading } = useUserBets(userId);

  const { byCat, byPct, byTime } = useMemo(() => {
    const rows = (bets ?? []).map((b: any) => {
      const staked = Number(b.amount) || 0;
      const settled = b.is_winner !== null;
      const net = settled ? (Number(b.payout_amount) || 0) - staked : 0;
      const end = settled ? new Date(b.markets?.updated_at ?? Date.now()) : new Date();
      const hours = Math.max(0, (end.getTime() - new Date(b.created_at).getTime()) / 36e5);
      return { staked, net, settled, pct: staked > 0 ? (net / staked) * 100 : 0, hours, cat: b.markets?.category || 'Sin categoría' };
    });
    const toRows = (m: Map<string, typeof rows>): Row[] =>
      [...m.entries()].map(([label, items]) => ({
        label, count: items.length,
        staked: items.reduce((s, i) => s + i.staked, 0),
        net: items.reduce((s, i) => s + i.net, 0),
      }));

    const pctOrder = ['Pérdida total', '-99% a 0%', '0% a 50%', '50% a 100%', '+100% o más'];
    const pctKey = (p: number) => p <= -100 ? pctOrder[0] : p < 0 ? pctOrder[1] : p < 50 ? pctOrder[2] : p < 100 ? pctOrder[3] : pctOrder[4];
    const timeOrder = ['< 1 hora', '1–24 horas', '1–7 días', '> 7 días'];
    const timeKey = (h: number) => h < 1 ? timeOrder[0] : h < 24 ? timeOrder[1] : h < 168 ? timeOrder[2] : timeOrder[3];
    const settled = rows.filter(r => r.settled);

    return {
      byCat: toRows(group(rows, r => r.cat)).sort((a, b) => b.count - a.count),
      byPct: toRows(group(settled, r => pctKey(r.pct), pctOrder)),
      byTime: toRows(group(rows, r => timeKey(r.hours), timeOrder)),
    };
  }, [bets]);

  if (isLoading) return <Card><CardContent className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  if (!bets?.length) return <Card><CardContent className="py-12 text-center text-muted-foreground">Aún no tienes predicciones para analizar.</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Section title="Por categoría" rows={byCat} metric="net" />
      <Section title="Por ganancia porcentual (solo resueltas)" rows={byPct} metric="count" />
      <Section title="Por tiempo de juego" rows={byTime} metric="net" />
    </div>
  );
}
