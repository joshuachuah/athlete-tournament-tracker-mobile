import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useState,
} from "react";

import { draftStorage } from "@/lib/storage";
import {
  defaultTournamentDraft,
  deriveDraftDates,
  type TournamentDraft,
} from "@/lib/tournament-draft";

const draftKey = "athlete-tracker:tournament-draft";

type TournamentDraftContextValue = {
  draft: TournamentDraft;
  setDraft: (draft: TournamentDraft) => void;
  updateDraft: (changes: Partial<TournamentDraft>) => void;
  resetDraft: () => void;
};

const TournamentDraftContext = createContext<TournamentDraftContextValue | null>(
  null,
);

export function TournamentDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraftState] = useState<TournamentDraft>(() => {
    return draftStorage.get<TournamentDraft>(draftKey) ?? defaultTournamentDraft;
  });

  useEffect(() => {
    draftStorage.set(draftKey, draft);
  }, [draft]);

  function setDraft(nextDraft: TournamentDraft) {
    setDraftState(deriveDraftDates(nextDraft));
  }

  function updateDraft(changes: Partial<TournamentDraft>) {
    setDraftState((current) => deriveDraftDates({ ...current, ...changes }));
  }

  function resetDraft() {
    draftStorage.clear(draftKey);
    setDraftState(defaultTournamentDraft);
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
