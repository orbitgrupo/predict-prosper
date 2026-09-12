import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Users, TrendingUp, Coins, Banknote } from 'lucide-react';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(var(--destructive))',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
  fontSize: '12px',
};

const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

interface DayBucket {
  key: string;
  label: string;
}

function lastDays(days: number): DayBucket[] {
  const out: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = startOfDay(subDays(new Date(), i));
    out.push({ key: format(d, 'yyyy-MM-dd'), label: format(d, 'dd MMM', { locale: es }) });
  }
  return out;
}

function useAnalytics() {
  return useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();

      const [profilesRes, marketsRes, betsRes, withdrawalsRes] = await Promise.all([
        supabase.from('profiles').select('id, created_at, balance'),
        supabase.from('markets').select('id, status, category, created_at'),
        supabase.from('bets').select('id, amount, created_at').gte('created_at', since),
        supabase.from('withdrawal_requests').select('id, amount, status, created_at'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (marketsRes.error) throw marketsRes.error;
      if (betsRes.error) throw betsRes.error;
      if (withdrawalsRes.error) throw withdrawalsRes.error;

      return {
        profiles: profilesRes.data ?? [],
        markets: marketsRes.data ?? [],
        bets: betsRes.data ?? [],
        withdrawals: withdrawalsRes.data ?? [],
      };
    },
    refetchInterval: 60000,
  });
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Activos',
  closed: 'Cerrados',
  resolved: 'Resueltos',
  pending: 'Pendientes',
  approved: 'Aprobados',
  rejected: 'Rechazados',
};

export function AnalyticsDashboard() {
  const { data, isLoading } = useAnalytics();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const days = lastDays(30);

  // Usuarios acumulados por día
  const usersByDay = days.map(({ key, label }) => {
    const end = new Date(`${key}T23:59:59`);
    const nuevos = data.profiles.filter(
      (p) => format(new Date(p.created_at), 'yyyy-MM-dd') === key
    ).length;
    const total = data.profiles.filter((p) => new Date(p.created_at) <= end).length;
    return { label, Nuevos: nuevos, Total: total };
  });

  // Mercados por estado
  const marketsByStatus = Object.entries(
    data.markets.reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, value]) => ({ name: STATUS_LABEL[status] ?? status, value }));

  // Mercados por categoría
  const marketsByCategory = Object.entries(
    data.markets.reduce<Record<string, number>>((acc, m) => {
      const c = m.category || 'Sin categoría';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, Mercados: value }));

  // Apuestas por día (últimos 30)
  const betsByDay = days.map(({ key, label }) => {
    const dayBets = data.bets.filter(
      (b) => format(new Date(b.created_at), 'yyyy-MM-dd') === key
    );
    return {
      label,
      Apuestas: dayBets.length,
      Volumen: dayBets.reduce((acc, b) => acc + Number(b.amount), 0),
    };
  });

  // Retiros por estado
  const withdrawalsByStatus = Object.entries(
    data.withdrawals.reduce<Record<string, { count: number; amount: number }>>((acc, w) => {
      const s = w.status as string;
      if (!acc[s]) acc[s] = { count: 0, amount: 0 };
      acc[s].count += 1;
      acc[s].amount += Number(w.amount);
      return acc;
    }, {})
  ).map(([status, v]) => ({
    name: STATUS_LABEL[status] ?? status,
    Solicitudes: v.count,
    Monto: v.amount,
  }));

  const totalBalance = data.profiles.reduce((acc, p) => acc + Number(p.balance), 0);
  const totalBetVolume = data.bets.reduce((acc, b) => acc + Number(b.amount), 0);
  const pendingWithdrawals = data.withdrawals.filter((w) => w.status === 'pending').length;

  const kpis = [
    { label: 'Usuarios', value: data.profiles.length.toLocaleString('es-ES'), icon: Users },
    { label: 'Mercados', value: data.markets.length.toLocaleString('es-ES'), icon: TrendingUp },
    {
      label: 'Volumen 30 días',
      value: `$${totalBetVolume.toLocaleString('es-ES')}`,
      icon: Coins,
    },
    { label: 'Retiros pendientes', value: pendingWithdrawals.toString(), icon: Banknote },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <k.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                  <p className="font-display text-lg sm:text-xl font-bold truncate">{k.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Crecimiento de usuarios (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usersByDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="Total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#usersFill)"
                  />
                  <Line type="monotone" dataKey="Nuevos" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Mercados por estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {marketsByStatus.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-20">Sin datos todavía.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={marketsByStatus}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {marketsByStatus.map((entry, i) => (
                        <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Apuestas y volumen (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={betsByDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis yAxisId="left" tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={axisTick} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="Apuestas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Volumen"
                    stroke="hsl(38, 92%, 50%)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Retiros por estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {withdrawalsByStatus.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-20">Aún no hay retiros.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={withdrawalsByStatus} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Solicitudes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Monto" fill="hsl(199, 89%, 48%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Mercados por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {marketsByCategory.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-20">Sin datos todavía.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketsByCategory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="Mercados" fill="hsl(262, 83%, 58%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Los saldos totales de todos los usuarios suman ${totalBalance.toLocaleString('es-ES')} créditos.
      </p>
    </div>
  );
}
