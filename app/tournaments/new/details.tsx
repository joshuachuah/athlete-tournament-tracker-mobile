import { router, useLocalSearchParams } from "expo-router";
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

type TournamentSaveVariables = {
  draft: TournamentDraft;
  userId: string;
  profileId: string;
  authToken: string;
};

type SubmitError = {
  userId: string;
  message: string;
};

export default function DetailsStep() {
  const { profile } = useAuth();
  const { draft, resetDraft } = useTournamentDraft();
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
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
    queryFn: ({ signal }) => api.tournaments.get(editId ?? "", { signal }),
    enabled: Boolean(editId),
  });
  const mutation = useMutation({
    mutationFn: (variables: TournamentSaveVariables) => {
      return saveTournamentDraft(
        variables.draft,
        variables.profileId,
        api.tournaments,
        { authToken: variables.authToken },
      );
    },
    onSuccess: (savedTournament, variables) => {
      if (session?.user.id !== variables.userId) {
        return;
      }

      completeTournamentSave(savedTournament.id, variables.profileId, {
        invalidate: (queryKey) => queryClient.invalidateQueries({ queryKey }),
        resetDraft,
        replace: (href) => router.replace(href),
      });
    },
    onError: (error, variables) => {
      if (session?.user.id === variables.userId) {
        setSubmitError({ userId: variables.userId, message: error.message });
      }
    },
  });

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
      loading={
        mutation.isPending && mutation.variables?.userId === session.user.id
      }
      submitError={
        submitError?.userId === session.user.id ? submitError.message : null
      }
      onSubmit={(nextDraft) => {
        setSubmitError(null);

        if (!session.user.id || !session.access_token || !profile.id) {
          setSubmitError({
            userId: session.user.id,
            message: "Sign in and save a profile before saving a tournament.",
          });
          return;
        }

        mutation.mutate({
          draft: nextDraft,
          userId: session.user.id,
          profileId: profile.id,
          authToken: session.access_token,
        });
      }}
    />
  ) : null;
}
