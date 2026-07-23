import { useLocalSearchParams } from "expo-router";

import { TournamentBuilderContainer } from "@/components/tournament/tournament-builder-container";
import type { TournamentDraftPrefill } from "@/lib/tournament-draft";

type DetailsParams = TournamentDraftPrefill & {
  editId?: string;
};

export default function DetailsStep() {
  const params = useLocalSearchParams<DetailsParams>();
  const editId = typeof params.editId === "string" ? params.editId : undefined;

  return <TournamentBuilderContainer editId={editId} prefill={params} />;
}
