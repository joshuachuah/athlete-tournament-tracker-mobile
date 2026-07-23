import { TournamentBuilderContainer } from "@/components/tournament/tournament-builder-container";
import { useAuth } from "@/context/auth";
import { TournamentDraftProvider } from "@/context/tournament-draft";

export default function AddScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return (
    <TournamentDraftProvider key={userId ?? "signed-out"} userId={userId}>
      <TournamentBuilderContainer />
    </TournamentDraftProvider>
  );
}
