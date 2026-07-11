import { Redirect } from "expo-router";

import { useTournamentDraft } from "@/context/tournament-draft";

export function LegacyTournamentRedirect() {
  const { draft } = useTournamentDraft();

  if (draft.editId) {
    return (
      <Redirect
        href={{
          pathname: "/tournaments/new/details",
          params: { editId: draft.editId },
        }}
      />
    );
  }

  return <Redirect href="/tournaments/new/details" />;
}
