import { useQuery } from '@tanstack/react-query';
import { baseballRefreshInterval, fetchBaseballGame } from '@/lib/baseball';

export function useBaseballGame(pk?: number | null) {
  return useQuery({
    queryKey: ['mlb-live', pk],
    queryFn: ({ signal }) => {
      if (!pk) throw new Error('Este mercado no tiene partido enlazado.');
      return fetchBaseballGame(pk, signal);
    },
    enabled: Boolean(pk),
    staleTime: 8_000,
    retry: 1,
    refetchInterval: query => baseballRefreshInterval(query.state.data?.state),
  });
}