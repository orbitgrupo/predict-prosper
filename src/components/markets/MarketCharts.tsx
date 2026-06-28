import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, TrendingUp } from 'lucide-react';

interface MarketChartsProps {
  marketId: string;
  options: { id: string; option_name: string; total_amount: number }[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
];

function useMarketSnapshots(marketId: string) {
  return useQuery({
    queryKey: ['market-snapshots', marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .eq('market_id', marketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });
}

export function MarketCharts({ marketId, options }: MarketChartsProps) {
  const { data: snapshots, isLoading } = useMarketSnapshots(marketId);

  const totalVolume = options.reduce((sum, o) => sum + o.total_amount, 0);
  const optionNames = options.map(o => o.option_name);

  // Build line chart data from snapshots; if none, synthesize a single point from current totals.
  const lineData = (() => {
    if (snapshots && snapshots.length > 0) {
      const grouped: Record<string, Record<string, number>> = {};
      for (const s of snapshots) {
        const key = s.created_at;
        if (!grouped[key]) grouped[key] = {};
        grouped[key][s.option_name] = Number(s.probability);
      }
      return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([timestamp, probs]) => ({
          time: format(new Date(timestamp), 'dd MMM HH:mm', { locale: es }),
          timestamp,
          ...probs,
        }));
    }

    if (totalVolume > 0) {
      const point: Record<string, number | string> = {
        time: format(new Date(), 'dd MMM HH:mm', { locale: es }),
      };
      for (const opt of options) {
        point[opt.option_name] = (opt.total_amount / totalVolume) * 100;
      }
      return [point];
    }

    return [];
  })();

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Evolución de probabilidades
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lineData.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">
            Aún no hay actividad. La gráfica se actualizará conforme se realicen apuestas.
          </p>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [`${Number(value).toFixed(1)}%`, name]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {optionNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2.5}
                    dot={lineData.length === 1 ? { r: 4 } : false}
                    activeDot={{ r: 5 }}
                    isAnimationActive
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
