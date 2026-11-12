import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Loader2, RefreshCw, Plus, ExternalLink } from 'lucide-react';
import { fetchBaseballSchedule, baseballStatus, BaseballGame } from '@/lib/baseball';
import { supabase } from '@/integrations/supabase/client';
import { useMarkets } from '@/hooks/useMarkets';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BaseballScoreboard } from '@/components/markets/BaseballScoreboard';
import { friendlyError } from '@/lib/errors';

function localDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function localTimeInput(date: Date) {
  return `${localDateInput(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function RealBaseballGames() {
  const [date, setDate] = useState(() => localDateInput(new Date()));
  const [teamFilter, setTeamFilter] = useState('');
  const [selected, setSelected] = useState<BaseballGame | null>(null);
  const [closesAt, setClosesAt] = useState('');
  const [imageUrl, setImageUrl] = useState('/markets/mlb-game.jpg');
  const [publishing, setPublishing] = useState(false);
  const { data: markets } = useMarkets();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: games = [], isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['mlb-schedule', date],
    queryFn: ({ signal }) => fetchBaseballSchedule(date, signal),
    enabled: Boolean(date),
    refetchInterval: 10_000,
    retry: 1,
  });
  const visible = games.filter(game => `${game.away.name} ${game.home.name}`.toLowerCase().includes(teamFilter.toLowerCase()));
  const linkedMarkets = markets?.filter(market => market.mlb_game_pk) ?? [];

  async function publish() {
    if (!selected || !closesAt) return;
    const close = new Date(closesAt);
    if (!Number.isFinite(close.getTime()) || close.getTime() <= Date.now() || close.getTime() < new Date(selected.startsAt).getTime()) {
      toast({ title: 'Revisa la fecha de cierre', description: 'Debe ser futura y no anterior al inicio del partido.', variant: 'destructive' });
      return;
    }
    if (imageUrl && !imageUrl.startsWith('/') && !/^https:\/\//i.test(imageUrl)) {
      toast({ title: 'Portada inválida', description: 'Utiliza una dirección HTTPS.', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    try {
      // Recheck official schedule immediately before publishing a real game.
      const schedule = await fetchBaseballSchedule(date);
      const official = schedule.find(game => game.pk === selected.pk);
      if (!official || official.state === 'Final' || /postponed|cancelled|canceled/i.test(official.detail)) {
        toast({ title: 'Partido no disponible', description: 'Ya terminó, fue cancelado o cambió su programación.', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.rpc('publish_baseball_game', {
        p_game_pk: official.pk, p_away: official.away.name, p_home: official.home.name,
        p_starts_at: official.startsAt, p_closes_at: close.toISOString(), p_image_url: imageUrl,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['markets'] });
      toast({ title: 'Partido publicado', description: 'El mercado ya tiene marcador, gráfica y predicciones.' });
      setSelected(null);
    } catch (error) {
      toast({ title: 'No se pudo publicar', description: friendlyError(error), variant: 'destructive' });
    } finally { setPublishing(false); }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold"><CalendarDays className="h-5 w-5 text-primary" />Partidos reales · MLB</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Actualizar</Button>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="mlb-date">Fecha del calendario MLB</Label><Input id="mlb-date" type="date" value={date} onChange={event => setDate(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="mlb-team">Equipo</Label><Input id="mlb-team" placeholder="Buscar equipo" value={teamFilter} onChange={event => setTeamFilter(event.target.value)} /></div>
      </div>
      <p className="text-xs text-muted-foreground">Horarios en {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
      {isPending ? <p role="status" className="py-8 text-muted-foreground">Consultando calendario oficial…</p> : isError ? <p role="alert" className="py-8 text-destructive">No se pudo cargar el calendario oficial. Intenta actualizar.</p> : visible.length === 0 ? <p className="border-y py-8 text-center text-muted-foreground">No hay partidos para esta fecha y equipo.</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map(game => {
            const existing = linkedMarkets.find(market => market.mlb_game_pk === game.pk);
            const unavailable = game.state === 'Final' || /postponed|cancelled|canceled/i.test(game.detail);
            return <article key={game.pk} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2"><Badge variant={game.state === 'Live' ? 'default' : 'secondary'}>{baseballStatus(game)}</Badge><span className="text-xs text-muted-foreground">MLB #{game.pk}</span></div>
              <h3 className="break-words font-semibold">{game.away.name} vs {game.home.name}</h3>
              <p className="text-sm text-muted-foreground">{new Date(game.startsAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              {game.state !== 'Preview' && <p className="text-lg font-bold tabular-nums">{game.away.abbr} {game.away.runs ?? '—'} – {game.home.runs ?? '—'} {game.home.abbr}</p>}
              {existing ? <Button asChild variant="outline" size="sm"><Link to={`/market/${existing.id}`}><ExternalLink className="mr-2 h-4 w-4" />Ver mercado</Link></Button> : <Button size="sm" disabled={unavailable} onClick={() => {
                setSelected(game);
                setClosesAt(localTimeInput(new Date(Math.max(new Date(game.startsAt).getTime() + 4 * 3600000, Date.now() + 3600000))));
              }}><Plus className="mr-2 h-4 w-4" />{unavailable ? 'No disponible' : 'Cargar partido'}</Button>}
            </article>;
          })}
        </div>
      )}
      <section className="border-t pt-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Partidos con mercado ({linkedMarkets.length})</h3>
        <div className="divide-y">{linkedMarkets.map(market => <div key={market.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="break-words font-medium">{market.title}</p><p className="text-xs text-muted-foreground">{market.status === 'resolved' ? 'Resuelto' : market.status === 'closed' ? 'Cerrado' : new Date(market.closes_at).getTime() <= Date.now() ? 'Vencido' : 'Publicado'}</p></div>
          <Button asChild variant="outline" size="sm"><Link to={`/market/${market.id}`}>Ver mercado<ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
        </div>)}</div>
      </section>
      <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !publishing) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Publicar partido real</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">
            <BaseballScoreboard pk={selected.pk} />
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Equipo visitante</Label><Input readOnly value={selected.away.name} /></div><div><Label>Equipo local</Label><Input readOnly value={selected.home.name} /></div></div>
            <div className="space-y-2"><Label>Fecha y hora oficial</Label><Input readOnly type="datetime-local" value={localTimeInput(new Date(selected.startsAt))} /></div>
            <div className="space-y-2"><Label htmlFor="mlb-close">Cierre de predicciones</Label><Input id="mlb-close" type="datetime-local" value={closesAt} onChange={event => setClosesAt(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="mlb-image">Portada</Label><Input id="mlb-image" value={imageUrl} onChange={event => setImageUrl(event.target.value)} />{imageUrl && <img src={imageUrl} alt="Portada del partido" className="aspect-video w-full rounded-lg object-cover" />}</div>
            <Button className="w-full" onClick={publish} disabled={publishing || !closesAt}>{publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Publicar mercado</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}