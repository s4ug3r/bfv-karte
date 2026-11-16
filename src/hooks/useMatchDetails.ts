import { useQuery } from '@tanstack/react-query';
import { fetchCompetitionTable, fetchTeamMatchesCached } from '../services/bfv/bfvClient';

const MIN = 60 * 1000;

/** Spielplan einer Mannschaft (Saison) – für Form und nächste Spiele. */
export function useTeamPlan(teamId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['teamPlan', teamId],
    queryFn: ({ signal }) => fetchTeamMatchesCached(teamId!, signal),
    enabled: enabled && !!teamId,
    staleTime: 15 * MIN,
    gcTime: 6 * 60 * MIN,
    retry: 1,
  });
}

/** Tabelle einer Liga. */
export function useTable(compoundId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['table', compoundId],
    queryFn: ({ signal }) => fetchCompetitionTable(compoundId!, signal),
    enabled: enabled && !!compoundId,
    staleTime: 30 * MIN,
    gcTime: 6 * 60 * MIN,
    retry: 1,
  });
}
