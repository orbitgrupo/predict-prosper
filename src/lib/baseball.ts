export interface BaseballTeam { id: number; name: string; abbr: string; runs: number | null }
export interface BaseballGame {
  pk: number; startsAt: string; state: string; detail: string;
  away: BaseballTeam; home: BaseballTeam;
  inning: string; balls: number; strikes: number; outs: number; play?: string;
}

const API = 'https://statsapi.mlb.com/api';
async function readOfficial(path: string, signal?: AbortSignal) {
  const response = await fetch(`${API}${path}`, { signal });
  if (!response.ok) throw new Error('No se pudo consultar el marcador oficial.');
  return response.json();
}

export async function fetchBaseballGame(pk: number, signal?: AbortSignal): Promise<BaseballGame> {
  const data = await readOfficial(`/v1.1/game/${pk}/feed/live`, signal);
  const game = data.gameData;
  if (!game?.teams || !game?.status) throw new Error('Partido no disponible.');
  const line = data.liveData?.linescore ?? {};
  const team = (side: 'away' | 'home'): BaseballTeam => ({
    id: game.teams[side].id, name: game.teams[side].name,
    abbr: game.teams[side].abbreviation, runs: line.teams?.[side]?.runs ?? null,
  });
  return {
    pk, startsAt: game.datetime.dateTime, state: game.status.abstractGameState,
    detail: game.status.detailedState, away: team('away'), home: team('home'),
    inning: line.currentInning ? `${line.inningHalf === 'Top' ? 'Alta' : 'Baja'} ${line.currentInning}` : '',
    balls: line.balls ?? 0, strikes: line.strikes ?? 0, outs: line.outs ?? 0,
    play: data.liveData?.plays?.currentPlay?.result?.description,
  };
}

export async function fetchBaseballSchedule(date: string, signal?: AbortSignal): Promise<BaseballGame[]> {
  const data = await readOfficial(`/v1/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=team`, signal);
  return (data.dates ?? []).flatMap((day: { games: any[] }) => day.games.map(game => ({
    pk: game.gamePk, startsAt: game.gameDate, state: game.status.abstractGameState,
    detail: game.status.detailedState, inning: '', balls: 0, strikes: 0, outs: 0,
    away: { id: game.teams.away.team.id, name: game.teams.away.team.name, abbr: game.teams.away.team.abbreviation, runs: game.teams.away.score ?? null },
    home: { id: game.teams.home.team.id, name: game.teams.home.team.name, abbr: game.teams.home.team.abbreviation, runs: game.teams.home.score ?? null },
  })));
}

export function baseballRefreshInterval(state?: string): number | false {
  return state === 'Final' ? false : 10_000;
}

export function baseballStatus(game: BaseballGame): string {
  if (game.state === 'Final') return 'Finalizado';
  if (game.state === 'Live') return game.detail === 'In Progress' ? `En vivo · ${game.inning}` : game.detail;
  if (game.detail === 'Scheduled' || game.detail === 'Pre-Game') return 'Por comenzar';
  return game.detail;
}