import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  clearLegacyTournamentDraft,
  draftStorage,
  tournamentDraftStorageKey,
} from "@/lib/storage";
import {
  createDefaultTournamentDraft,
  deriveDraftDates,
  normalizeTournamentDraft,
  persistedTournamentDraft,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import { usePersistedDraft } from "@/hooks/use-persisted-draft";

type TournamentDraftContextValue = {
  draft: TournamentDraft;
  setDraft: (draft: TournamentDraft) => void;
  updateDraft: (changes: Partial<TournamentDraft>) => void;
  resetDraft: () => void;
};

const TournamentDraftContext = createContext<TournamentDraftContextValue | null>(
  null,
);

export function TournamentDraftProvider({
  children,
  userId,
}: PropsWithChildren<{ userId?: string }>) {
  const draftKey = userId ? tournamentDraftStorageKey(userId) : null;
  const draftClearVersion = useRef(
    draftKey ? draftStorage.clearVersion(draftKey) : 0,
  );
  const [draft, setDraftState] = useState<TournamentDraft>(() => {
    const stored = draftKey ? draftStorage.get(draftKey) : null;
    return stored ? normalizeTournamentDraft(stored) : createDefaultTournamentDraft();
  });

  useEffect(() => {
    clearLegacyTournamentDraft();
  }, []);

  function persistDraft(nextDraft: TournamentDraft) {
    if (
      draftKey &&
      draftStorage.clearVersion(draftKey) === draftClearVersion.current
    ) {
      draftStorage.set(draftKey, persistedTournamentDraft(nextDraft));
    }
  }

  usePersistedDraft(draft, persistDraft, draftKey);

  function setDraft(nextDraft: TournamentDraft) {
    setDraftState(deriveDraftDates(nextDraft));
  }

  function updateDraft(changes: Partial<TournamentDraft>) {
    setDraftState((current) => deriveDraftDates({ ...current, ...changes }));
  }

  function resetDraft() {
    if (draftKey) {
      draftStorage.clear(draftKey);
      draftClearVersion.current = draftStorage.clearVersion(draftKey);
    }
    setDraftState(createDefaultTournamentDraft());
  }

  return (
    <TournamentDraftContext.Provider
      value={{ draft, setDraft, updateDraft, resetDraft }}
    >
      {children}
    </TournamentDraftContext.Provider>
  );
}

export function useTournamentDraft() {
  const value = use(TournamentDraftContext);

  if (!value) {
    throw new Error("useTournamentDraft must be used in TournamentDraftProvider.");
  }

  return value;
}
