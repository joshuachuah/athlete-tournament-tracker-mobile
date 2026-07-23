import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";

import { ProjectionSuccessSheet } from "@/components/tournament/projection-success-sheet";
import { TournamentProjectionBuilder } from "@/components/tournament/tournament-projection-builder";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { useAuth } from "@/context/auth";
import { useTournamentDraft } from "@/context/tournament-draft";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import {
  completeTournamentSaveData,
  resumableDraft,
  saveTournamentDraft,
  tournamentDraftFromPrefill,
  tournamentToDraft,
  type TournamentDraft,
  type TournamentDraftPrefill,
} from "@/lib/tournament-draft";
import type { TournamentWithPnL } from "@/types";

type SavedProjection = {
  mode: "create" | "edit";
  tournament: TournamentWithPnL;
};

type TournamentSaveVariables = {
  draft: TournamentDraft;
  userId: string;
  profileId: string;
};

type SubmitError = {
  userId: string;
  message: string;
};

function hasPrefill(prefill: TournamentDraftPrefill | undefined) {
  if (!prefill) return false;
  return [
    prefill.name,
    prefill.location,
    prefill.country,
    prefill.currency,
    prefill.start_date,
    prefill.end_date,
    prefill.duration_days,
    prefill.prize_rounds,
    prefill.prize_tax_rate,
  ].some(Boolean);
}

export function TournamentBuilderContainer({
  editId,
  prefill,
}: {
  editId?: string;
  prefill?: TournamentDraftPrefill;
}) {
  const { isCurrentUser, profile, session } = useAuth();
  const { draft, resetDraft } = useTournamentDraft();
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [savedProjection, setSavedProjection] = useState<SavedProjection | null>(null);
  const completedSaveDataId = useRef<string | null>(null);
  const navigatedSaveId = useRef<string | null>(null);
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
    mutationFn: (variables: TournamentSaveVariables) =>
      saveTournamentDraft(variables.draft, variables.profileId, api.tournaments, {
        authenticatedUserId: variables.userId,
      }),
    onSuccess: (saved, variables) => {
      if (!isCurrentUser(variables.userId)) return;
      if (completedSaveDataId.current !== saved.id) {
        completedSaveDataId.current = saved.id;
        completeTournamentSaveData(saved.id, variables.profileId, {
          invalidate: (queryKey) => queryClient.invalidateQueries({ queryKey }),
          resetDraft,
        });
      }
      setSavedProjection({
        mode: variables.draft.editId ? "edit" : "create",
        tournament: saved,
      });
    },
    onError: (error, variables) => {
      if (isCurrentUser(variables.userId)) {
        setSubmitError({ userId: variables.userId, message: error.message });
      }
    },
  });

  if (!session || !profile) return null;

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

  const shouldPrefill = hasPrefill(prefill);
  const initialDraft = editTournament
    ? tournamentToDraft(editTournament)
    : shouldPrefill && prefill
      ? tournamentDraftFromPrefill(prefill)
      : resumableDraft(draft);
  const builderKey = editTournament
    ? `edit:${editTournament.id}`
    : shouldPrefill
      ? `prefill:${JSON.stringify(prefill)}`
      : "resume";

  function finishSavedProjection() {
    if (!savedProjection || navigatedSaveId.current === savedProjection.tournament.id) return;
    navigatedSaveId.current = savedProjection.tournament.id;
    router.replace(`/tournaments/${savedProjection.tournament.id}`);
  }

  return (
    <>
      <TournamentProjectionBuilder
        key={builderKey}
        authenticatedUserId={session.user.id}
        homeCurrency={profile.home_currency}
        initialDraft={initialDraft}
        loading={
          mutation.isPending && mutation.variables?.userId === session.user.id
        }
        profileId={profile.id}
        sport={profile.sport}
        submitError={
          submitError?.userId === session.user.id ? submitError.message : null
        }
        onSubmit={(nextDraft) => {
          setSubmitError(null);
          if (!session.user.id || !profile.id) {
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
          });
        }}
      />

      {savedProjection ? (
        <ProjectionSuccessSheet
          mode={savedProjection.mode}
          tournament={savedProjection.tournament}
          onDismiss={finishSavedProjection}
          onView={finishSavedProjection}
        />
      ) : null}
    </>
  );
}
