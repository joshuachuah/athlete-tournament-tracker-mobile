import { useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api";
import {
  toTournamentPreviewPayload,
  type TournamentDraft,
} from "@/lib/tournament-draft";

export function useTournamentPreview({
  authenticatedUserId,
  draft,
  enabled,
  homeCurrency,
  profileId,
}: {
  authenticatedUserId: string;
  draft: TournamentDraft;
  enabled: boolean;
  homeCurrency: string;
  profileId: string;
}) {
  const serializedPayload = enabled
    ? JSON.stringify(toTournamentPreviewPayload(draft, profileId))
    : "";
  const debouncedPayload = useDebouncedValue(serializedPayload, 350);
  const waitingForDebounce = enabled && serializedPayload !== debouncedPayload;
  const query = useQuery({
    queryKey: [
      "tournament-pnl-preview",
      homeCurrency.toUpperCase(),
      debouncedPayload,
    ],
    queryFn: ({ signal }) =>
      api.tournaments.preview(JSON.parse(debouncedPayload), {
        signal,
        authenticatedUserId,
      }),
    enabled: enabled && Boolean(debouncedPayload) && !waitingForDebounce,
    retry: false,
  });

  const isLoadingPreview = waitingForDebounce || query.isFetching;

  return {
    ...query,
    data: !enabled || isLoadingPreview ? undefined : query.data,
    isLoadingPreview,
  };
}
