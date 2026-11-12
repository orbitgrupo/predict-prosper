import { useBaseballGame } from '@/hooks/useBaseballGame';
import { baseballStatus } from '@/lib/baseball';

export function BaseballScoreboard({ pk, compact = false }: { pk: number; compact?: boolean }) {
  const { data: game, isPending, isError, dataUpdatedAt } = useBaseballGame(pk);
  if (!game) return <p role="status" className="py-3 text-center text-xs text-muted-foreground">{isPending ? 'Cargando marcador…' : 'Marcador no disponible'}</p>;
  return (
    <section aria-label="Marcador oficial MLB" aria-live="polite" className={compact ? 'mt-3 border-y py-3' : 'border-y px-4 py-4 sm:px-6'}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={game.state === 'Live' ? 'font-semibold text-destructive' : 'font-semibold text-muted-foreground'}>{baseballStatus(game)}</span>
        <span className="text-muted-foreground">MLB</span>
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <span className="min-w-0 break-words text-sm font-semibold">{compact ? game.away.abbr : game.away.name}<span className="block text-xs font-normal text-muted-foreground">Visitante</span></span>
        <strong className="whitespace-nowrap text-2xl tabular-nums">{game.away.runs ?? '—'} – {game.home.runs ?? '—'}</strong>
        <span className="min-w-0 break-words text-right text-sm font-semibold">{compact ? game.home.abbr : game.home.name}<span className="block text-xs font-normal text-muted-foreground">Local</span></span>
      </div>
      {!compact && <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{game.state === 'Live' ? `Bolas ${game.balls} · Strikes ${game.strikes} · Outs ${game.outs}` : new Date(game.startsAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <span>{isError ? 'Sin conexión · último marcador recibido' : `Actualizado ${new Date(dataUpdatedAt).toLocaleTimeString('es-ES')}`}</span>
      </div>}
    </section>
  );
}