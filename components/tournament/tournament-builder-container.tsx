import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";

import { ProjectionSuccessSheet } from "@/components/tournament/projection-success-sheet";
import { TournamentProjectionBuilder } from "@/components/tournament/tournament-projection-builder";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { useAuth } from "@/context/auth";
import { useTournamentDraft } from "@/context/tournament-draft";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { queryClient } from "@/lib/query-client";
import {
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
  const [createSession, setCreateSession] = useState(0);
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
    onSuccess: async (saved, variables) => {
      if (!isCurrentUser(variables.userId)) return;
      await queryClient.cancelQueries({
        queryKey: ["tournament", saved.id],
        exact: true,
      });
      // The account can change while cancellation settles.
      if (!isCurrentUser(variables.userId)) return;

      if (completedSaveDataId.current !== saved.id) {
        completedSaveDataId.current = saved.id;
        queryClient.setQueryData(["tournament", saved.id], saved);
        queryClient.invalidateQueries({
          queryKey: ["tournaments", variables.profileId],
        });
        resetDraft();
      }
      setSavedProjection({
        mode: variables.draft.editId ? "edit" : "create",
        tournament: saved,
      });
    },
    onError: (error, variables) => {
      if (isCurrentUser(variables.userId)) {
        setSubmitError({
          userId: variables.userId,
          message: errorMessage(error, "Couldn't save this tournament."),
        });
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
        message={errorMessage(
          editTournamentError,
          "Couldn't load this tournament.",
        )}
        onRetry={() => refetchEditTournament()}
      />
    );
  }

  if (editTournament?.result) {
    return (
      <EmptyState
        title="Projection locked"
        body="Remove the recorded result before changing this tournament's original projection."
        action={
          <Button
            label="View tournament result"
            onPress={() => router.replace(`/tournaments/${editTournament.id}`)}
          />
        }
      />
    );
  }

  const shouldPrefill = hasPrefill(prefill);
  const initialDraft = editTournament
    ? tournamentToDraft(editTournament)
    : shouldPrefill && prefill
      ? tournamentDraftFromPrefill(prefill)
      : resumableDraft(draft);
  const offerResume =
    !editTournament && !shouldPrefill && Boolean(initialDraft.name.trim());
  const builderKey = editTournament
    ? `edit:${editTournament.id}`
    : shouldPrefill
      ? `prefill:${JSON.stringify(prefill)}`
      : `create:${createSession}`;

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
        resume={
          offerResume
            ? {
                onStartAnotherTournament: () => {
                  resetDraft();
                  setSubmitError(null);
                  setCreateSession((current) => current + 1);
                },
              }
            : undefined
        }
        saveCompleted={Boolean(savedProjection)}
        sport={profile.sport}
        submitError={
          submitError?.userId === session.user.id ? submitError.message : null
        }
        onClearSubmitError={() => setSubmitError(null)}
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
