import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

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
    placeholderData: keepPreviousData,
    retry: false,
  });

  const isLoadingPreview = waitingForDebounce || query.isFetching;
  const previewOwner = `${authenticatedUserId}:${profileId}:${homeCurrency.toUpperCase()}`;
  const lastSuccessfulPreview = useRef<
    | {
        data: NonNullable<typeof query.data>;
        owner: string;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    if (!enabled) {
      lastSuccessfulPreview.current = undefined;
      return;
    }

    if (query.data && !query.isPlaceholderData) {
      lastSuccessfulPreview.current = { data: query.data, owner: previewOwner };
    }
  }, [enabled, previewOwner, query.data, query.isPlaceholderData]);

  const queryDataForOwner =
    query.isPlaceholderData &&
    lastSuccessfulPreview.current?.owner !== previewOwner
      ? undefined
      : query.data;
  const lastData = enabled
    ? (queryDataForOwner ??
      (lastSuccessfulPreview.current?.owner === previewOwner
        ? lastSuccessfulPreview.current.data
        : undefined))
    : undefined;

  return {
    ...query,
    data: !enabled || isLoadingPreview ? undefined : query.data,
    // Keep the previous result available for the outcome card while a new
    // preview loads. `data` stays hidden so other preview labels never use a
    // stale withholding rate against edited inputs.
    lastData,
    isLoadingPreview,
  };
}
