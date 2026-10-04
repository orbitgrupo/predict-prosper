import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';

type Opt = { id: string; option_name: string; total_amount: number };

const TEAM_COLORS: Record<string, string> = {
  padres: '#FFC425', brewers: '#12284B', yankees: '#0C2340', 'red sox': '#BD3039', dodgers: '#005A9C',
  giants: '#FD5A1E', mets: '#FF5910', cubs: '#0E3386', 'white sox': '#27251F', cardinals: '#C41E3A',
  braves: '#CE1141', phillies: '#E81828', astros: '#EB6E1F', rangers: '#003278', mariners: '#005C5C',
  angels: '#BA0021', athletics: '#003831', blue: '#134A8E', 'blue jays': '#134A8E', orioles: '#DF4601',
  rays: '#8FBCE6', guardians: '#E50022', tigers: '#FA4616', twins: '#002B5C', royals: '#004687',
  pirates: '#FDB827', reds: '#C6011F', marlins: '#00A3E0', nationals: '#AB0003', rockies: '#33006F',
  diamondbacks: '#A71930', 'd-backs': '#A71930',
  dominicana: '#002D62', 'república dominicana': '#002D62', venezuela: '#CF142B', japón: '#BC002D', japan: '#BC002D',
  'estados unidos': '#0A3161', usa: '#0A3161', 'puerto rico': '#ED0000', méxico: '#006847', mexico: '#006847',
  cuba: '#002A8F', corea: '#003478', panamá: '#DA121A', colombia: '#FCD116', nicaragua: '#0067C6',
  licey: '#0033A0', escogido: '#C8102E', águilas: '#FFCD00', aguilas: '#FFCD00', estrellas: '#00843D',
  toros: '#B5121B', gigantes: '#E35205',
};
const FALLBACK = ['#F5A623', '#0B2545', '#E63946', '#2A9D8F', '#6A4C93', '#1D70B8'];

export function teamColor(name: string, i: number) {
  const n = name.toLowerCase();
  const key = Object.keys(TEAM_COLORS).sort((a, b) => b.length - a.length).find(k => n.includes(k));
  return key ? TEAM_COLORS[key] : FALLBACK[i % FALLBACK.length];
}

export function isBaseballMarket(m: { title: string; category?: string | null; description?: string | null }) {
  const t = `${m.title} ${m.category ?? ''} ${m.description ?? ''}`.toLowerCase();
  return /b[eé]isbol|baseball|mlb|pelota|serie del caribe|lidom|grandes ligas/.test(t);
}

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export function GameMarketView({ market, options }: { market: { id: string; title: string; category?: string | null }; options: Opt[] }) {
  const teams = [...options].sort((a, b) => b.total_amount - a.total_amount).slice(0, 2);
  const total = options.reduce((s, o) => s + o.total_amount, 0);
  const pct = (o: Opt) => (total > 0 ? (o.total_amount / total) * 100 : 100 / options.length);
  const colors = Object.fromEntries(options.map((o, i) => [o.option_name, teamColor(o.option_name, i)]));

  const { data: snaps } = useQuery({
    queryKey: ['market-snapshots', market.id],
    queryFn: async () => (await supabase.from('market_snapshots').select('*').eq('market_id', market.id).order('created_at')).data ?? [],
    refetchInterval: 5000,
  });
  const { data: recent } = useQuery({
    queryKey: ['recent-bets', market.id],
    queryFn: async () => (await supabase.rpc('get_recent_market_bets', { p_market_id: market.id, p_limit: 6 })).data ?? [],
    refetchInterval: 4000,
  });

  const grouped: Record<string, Record<string, number>> = {};
  (snaps ?? []).forEach(s => { (grouped[s.created_at] ??= {})[s.option_name] = Number(s.probability); });
  let data = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([t, p]) => ({ t, ...p }));
  const now = Object.fromEntries(teams.map(o => [o.option_name, pct(o)]));
  data = data.length ? [...data, { t: 'now', ...now }] : [{ t: 'a', ...Object.fromEntries(teams.map(() => ['', 50])), ...Object.fromEntries(teams.map(o => [o.option_name, 100 / options.length])) }, { t: 'now', ...now }];

  const fmt = (n: number) => `$${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-4 sm:px-6 pt-5" style={{ background: `linear-gradient(135deg, ${colors[teams[0]?.option_name]}22, transparent 60%, ${colors[teams[1]?.option_name]}22)` }}>
        <p className="text-sm text-muted-foreground">Béisbol{market.category ? ` • ${market.category}` : ''}</p>
        <h2 className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight">{market.title}</h2>
        <div className="flex items-center justify-between py-5">
          {teams.map((t, i) => (
            <div key={t.id} className={`flex flex-col items-center gap-2 ${i === 1 ? 'order-3' : ''}`}>
              <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-black shadow-lg ring-4 ring-background" style={{ backgroundColor: colors[t.option_name], color: '#fff' }}>
                {initials(t.option_name)}
              </div>
              <span className="text-sm font-semibold">{t.option_name}</span>
            </div>
          ))}
          <div className="order-2 flex flex-col items-center">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> EN VIVO
            </span>
            <span className="text-xs text-muted-foreground mt-1">{fmt(total)} vol.</span>
          </div>
        </div>
      </div>

      <div className="relative h-72 border-t border-dashed">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 30, right: 110, left: 0, bottom: 20 }}>
            <YAxis hide domain={[0, 100]} />
            {teams.map(t => (
              <Line key={t.id} type="stepAfter" dataKey={t.option_name} stroke={colors[t.option_name]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>

        <div className="absolute right-3 inset-y-0 flex flex-col justify-around pointer-events-none">
          {[...teams].sort((a, b) => pct(b) - pct(a)).map(t => (
            <div key={t.id} className="text-right">
              <p className="text-sm font-medium" style={{ color: colors[t.option_name] }}>{t.option_name}</p>
              <p className="font-display text-3xl font-black" style={{ color: colors[t.option_name] }}>{pct(t).toFixed(0)}%</p>
            </div>
          ))}
        </div>

        <div className="absolute left-3 bottom-4 flex flex-col-reverse gap-1 pointer-events-none">
          {(recent ?? []).map((b, i) => (
            <span key={b.id} className="text-sm font-bold animate-fade-in transition-opacity"
              style={{ color: colors[b.option] ?? 'hsl(var(--muted-foreground))', opacity: 1 - i * 0.15 }}>
              +{fmt(Number(b.amount))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
