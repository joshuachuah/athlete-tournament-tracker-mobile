import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

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
  const previewOwner = `${authenticatedUserId}:${profileId}:${homeCurrency.toUpperCase()}`;
  const { data, error, isError, isFetching, refetch } = useQuery({
    queryKey: [
      "tournament-pnl-preview",
      previewOwner,
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

  const isLoadingPreview = waitingForDebounce || isFetching;
  const [lastSuccessfulPreview, setLastSuccessfulPreview] = useState<
    { data: typeof data; owner: string } | undefined
  >(undefined);

  // Remember the last result for this owner across input changes and failures.
  // Update during this render so disabling or changing owners clears it before
  // children render, without an effect or render-time ref reads.
  if (!enabled) {
    if (lastSuccessfulPreview) setLastSuccessfulPreview(undefined);
  } else if (
    lastSuccessfulPreview?.owner !== previewOwner ||
    (data !== undefined && data !== lastSuccessfulPreview.data)
  ) {
    setLastSuccessfulPreview({ data, owner: previewOwner });
  }

  const lastData = enabled
    ? (data ??
      (lastSuccessfulPreview?.owner === previewOwner
        ? lastSuccessfulPreview.data
        : undefined))
    : undefined;

  return {
    data: !enabled || isLoadingPreview ? undefined : data,
    // Only the outcome card may show a retained result while inputs change.
    lastData,
    error,
    isError,
    isLoadingPreview,
    refetch,
  };
}
