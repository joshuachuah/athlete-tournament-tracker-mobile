import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { TournamentForm } from "@/components/tournament/tournament-form";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { useAuth } from "@/context/auth";
import { useTournamentDraft } from "@/context/tournament-draft";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import {
  completeTournamentSave,
  resumableDraft,
  saveTournamentDraft,
  tournamentDraftFromPrefill,
  tournamentToDraft,
  type TournamentDraftPrefill,
  type TournamentDraft,
} from "@/lib/tournament-draft";

type DetailsParams = TournamentDraftPrefill & {
  editId?: string;
};

export default function DetailsStep() {
  const { profile, session } = useAuth();
  const { draft, resetDraft } = useTournamentDraft();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const params = useLocalSearchParams<DetailsParams>();
  const editId = typeof params.editId === "string" ? params.editId : undefined;
  const {
    data: editTournament,
    error: editTournamentError,
    isError: editTournamentIsError,
    isLoading: editTournamentLoading,
    refetch: refetchEditTournament,
  } = useQuery({
    queryKey: ["tournament", editId],
    queryFn: () => api.tournaments.get(editId ?? ""),
    enabled: Boolean(editId),
  });
  const mutation = useMutation({
    mutationFn: (nextDraft: TournamentDraft) => {
      if (!profile) {
        throw new Error("Save a profile before creating a tournament.");
      }

      return saveTournamentDraft(nextDraft, profile.id, api.tournaments);
    },
    onSuccess: (savedTournament) => {
      completeTournamentSave(savedTournament.id, profile?.id, {
        invalidate: (queryKey) => queryClient.invalidateQueries({ queryKey }),
        resetDraft,
        replace: (href) => router.replace(href),
      });
    },
    onError: (error) => setSubmitError((error as Error).message),
  });

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  const hasPrefill = [
    params.name,
    params.location,
    params.country,
    params.currency,
    params.start_date,
    params.end_date,
    params.duration_days,
    params.prize_rounds,
    params.prize_tax_rate,
  ].some(Boolean);
  const initialDraft = editTournament
    ? tournamentToDraft(editTournament)
    : hasPrefill
      ? tournamentDraftFromPrefill(params)
      : resumableDraft(draft);
  const formKey = editTournament
    ? `edit:${editTournament.id}`
    : hasPrefill
      ? `prefill:${JSON.stringify([
          params.name,
          params.location,
          params.country,
          params.currency,
          params.start_date,
          params.end_date,
          params.duration_days,
          params.prize_rounds,
          params.prize_tax_rate,
        ])}`
      : "resume";

  if (editTournamentLoading) {
    return <LoadingState label="Loading tournament" />;
  }

  if (editTournamentIsError) {
    return (
      <ErrorState
        message={editTournamentError.message}
        onRetry={() => refetchEditTournament()}
      />
    );
  }

  return !editId || editTournament ? (
    <TournamentForm
      key={formKey}
      initialDraft={initialDraft}
      loading={mutation.isPending}
      submitError={submitError}
      onSubmit={(nextDraft) => {
        setSubmitError(null);
        mutation.mutate(nextDraft);
      }}
    />
  ) : null;
}
