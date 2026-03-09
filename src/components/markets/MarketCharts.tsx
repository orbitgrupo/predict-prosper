import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, TrendingUp, PieChart as PieIcon } from 'lucide-react';

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
  });
}

export function MarketCharts({ marketId, options }: MarketChartsProps) {
  const { data: snapshots, isLoading } = useMarketSnapshots(marketId);

  const totalVolume = options.reduce((sum, o) => sum + o.total_amount, 0);

  // Pie chart data
  const pieData = options.map((opt, i) => ({
    name: opt.option_name,
    value: opt.total_amount,
    percentage: totalVolume > 0 ? ((opt.total_amount / totalVolume) * 100).toFixed(1) : '0',
    color: COLORS[i % COLORS.length],
  }));

  // Line chart data: group snapshots by timestamp
  const lineData = (() => {
    if (!snapshots || snapshots.length === 0) return [];

    const grouped: Record<string, Record<string, number>> = {};
    for (const s of snapshots) {
      const key = s.created_at;
      if (!grouped[key]) grouped[key] = {};
      grouped[key][s.option_name] = Number(s.probability);
    }

    return Object.entries(grouped).map(([timestamp, probs]) => ({
      time: format(new Date(timestamp), 'dd MMM HH:mm', { locale: es }),
      timestamp,
      ...probs,
    }));
  })();

  const optionNames = options.map(o => o.option_name);

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg">Rendimiento del mercado</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <Tabs defaultValue="distribution" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="distribution" className="gap-2">
              <PieIcon className="h-4 w-4" />
              Distribución
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="distribution" className="mt-4">
            {totalVolume === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Aún no hay apuestas en este mercado.
              </p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString('es-ES')}`, 'Monto']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : lineData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Los datos históricos se generarán conforme se realicen apuestas.
              </p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
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
                      }}
                    />
                    {optionNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
