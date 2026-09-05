import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import {
  notifyManager,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { PropsWithChildren, ReactElement } from "react";
import { Alert } from "react-native";

import TournamentDetailScreen from "@/app/tournaments/[id]";
import DetailsStep from "@/app/tournaments/new/details";
import { queryClient } from "@/lib/query-client";
import type { TournamentWithPnL } from "@/types";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockResetDraft = jest.fn();
const mockGetTournament = jest.fn();
const mockCreateTournament = jest.fn();
const mockUpdateTournament = jest.fn();
const mockDeleteTournament = jest.fn();
const mockBuilderEdit = jest.fn();
let mockParams: Record<string, string> = {};
let mockAuthState = authState("account-a", "profile-a", "account-a-token");

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { Text: NativeText } = jest.requireActual("react-native");

  return {
    Redirect: ({ href }: { href: unknown }) =>
      React.createElement(
        NativeText,
        { testID: "redirect-href" },
        JSON.stringify(href),
    ),
    router: {
      push: (...args: unknown[]) => mockPush(...args),
      replace: (...args: unknown[]) => mockReplace(...args),
    },
    useLocalSearchParams: () => mockParams,
  };
});

jest.mock("@/context/auth", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("@/context/tournament-draft", () => {
  const { createDefaultTournamentDraft: createDraft } = jest.requireActual(
    "@/lib/tournament-draft",
  );

  return {
    useTournamentDraft: () => ({
      draft: createDraft(new Date(2026, 0, 1)),
      resetDraft: mockResetDraft,
    }),
  };
});

jest.mock("@/components/tournament/tournament-projection-builder", () => {
  const React = jest.requireActual("react");
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual("react-native");

  return {
    TournamentProjectionBuilder: ({
      initialDraft,
      loading,
      onSubmit,
      submitError,
    }: {
      initialDraft: Record<string, unknown>;
      loading?: boolean;
      onSubmit: (draft: Record<string, unknown>) => void;
      submitError?: string | null;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          NativePressable,
          {
            accessibilityRole: "button",
            disabled: loading,
            testID: "submit-tournament",
            onPress: () => onSubmit(initialDraft),
          },
          React.createElement(NativeText, null, "Submit tournament"),
        ),
        React.createElement(
          NativePressable,
          {
            disabled: loading,
            testID: "edit-builder-while-saving",
            onPress: mockBuilderEdit,
          },
          React.createElement(NativeText, null, "Edit builder"),
        ),
        submitError
          ? React.createElement(NativeText, null, submitError)
          : null,
      ),
  };
});

jest.mock("@/components/tournament/projection-success-sheet", () => {
  const React = jest.requireActual("react");
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual("react-native");

  return {
    ProjectionSuccessSheet: ({
      onDismiss,
      onView,
      mode,
      tournament: saved,
    }: {
      onDismiss: () => void;
      onView: () => void;
      mode: "create" | "edit";
      tournament: TournamentWithPnL;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(NativeText, null, `${saved.name} ${mode}`),
        React.createElement(
          NativePressable,
          { testID: "view-saved-projection", onPress: onView },
          React.createElement(NativeText, null, "View projection"),
        ),
        React.createElement(
          NativePressable,
          { testID: "dismiss-saved-projection", onPress: onDismiss },
          React.createElement(NativeText, null, "Dismiss"),
        ),
      ),
  };
});

jest.mock("@/lib/api", () => ({
  api: {
    tournaments: {
      create: (...args: unknown[]) => mockCreateTournament(...args),
      delete: (...args: unknown[]) => mockDeleteTournament(...args),
      get: (...args: unknown[]) => mockGetTournament(...args),
      update: (...args: unknown[]) => mockUpdateTournament(...args),
    },
  },
}));

const tournament: TournamentWithPnL = {
  id: "tournament-1",
  user_id: "profile-a",
  name: "Account A Open",
  location: "Kuala Lumpur",
  country: "Malaysia",
  currency: "MYR",
  start_date: "2026-01-01",
  end_date: "2026-01-03",
  duration_days: 3,
  entry_fee: 100,
  flight_cost: 200,
  accommodation_total: 300,
  daily_spending_cap: 50,
  coaching_cost: 25,
  misc_cost: 10,
  subsidy_by: null,
  subsidy_amount: 0,
  subsidy_covers: null,
  sponsorship_allocated: 0,
  prize_rounds: {},
  prize_tax_rate: 0,
  created_at: "2026-01-01T00:00:00Z",
  home_currency: "MYR",
  pnl: {
    total_income_base: 0,
    total_expenses: 0,
    scenarios: [],
    break_even_round: null,
  },
};

function authState(userId: string, profileId: string, accessToken: string) {
  return {
    session: {
      access_token: accessToken,
      user: { id: userId },
    },
    profile: {
      id: profileId,
    },
    isCurrentUser: (candidateUserId: string) =>
      mockAuthState.session.user.id === candidateUserId,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function settleMutation(settle: () => void) {
  await act(async () => {
    settle();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderWithClient(element: ReactElement) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return render(element, { wrapper: Wrapper });
}

async function renderSaveScreen(kind: "create" | "update") {
  mockParams = kind === "update" ? { editId: tournament.id } : {};
  mockGetTournament.mockResolvedValue(tournament);
  const screen = renderWithClient(<DetailsStep />);

  if (kind === "update") {
    await waitFor(() =>
      expect(screen.getByTestId("submit-tournament")).toBeTruthy(),
    );
  }

  return screen;
}

async function startDelete() {
  mockParams = { id: tournament.id };
  mockGetTournament.mockResolvedValue(tournament);
  const screen = renderWithClient(<TournamentDetailScreen />);

  await waitFor(() => expect(screen.getByText("Delete")).toBeTruthy());
  fireEvent.press(screen.getByText("Delete"));

  const buttons = (Alert.alert as jest.Mock).mock.calls[0]?.[2] as
    | { text?: string; onPress?: () => void }[]
    | undefined;
  const confirm = buttons?.find((button) => button.text === "Delete");
  act(() => confirm?.onPress?.());

  return screen;
}

async function switchAccount(screen: ReturnType<typeof render>, element: ReactElement) {
  mockAuthState = authState("account-b", "profile-b", "account-b-token");
  await act(async () => {
    screen.rerender(element);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  queryClient.setDefaultOptions({
    mutations: { gcTime: Infinity, retry: false },
    queries: { gcTime: Infinity, retry: false, staleTime: 60_000 },
  });
  jest.spyOn(queryClient, "invalidateQueries");
  jest.spyOn(queryClient, "setQueryData");
  mockParams = {};
  mockAuthState = authState("account-a", "profile-a", "account-a-token");
  jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
});

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => act(callback));
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => callback());
});

describe.each(["create", "update"] as const)(
  "%s tournament auth isolation",
  (kind) => {
    it("binds the request to the initiating user and ignores late success after an account switch", async () => {
      const request = deferred<TournamentWithPnL>();
      const mutation =
        kind === "create" ? mockCreateTournament : mockUpdateTournament;
      mutation.mockReturnValue(request.promise);
      const screen = await renderSaveScreen(kind);

      fireEvent.press(screen.getByTestId("submit-tournament"));
      await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));

      if (kind === "create") {
        expect(mutation).toHaveBeenCalledWith(
          expect.objectContaining({ user_id: "profile-a" }),
          { authenticatedUserId: "account-a" },
        );
      } else {
        expect(mutation).toHaveBeenCalledWith(
          tournament.id,
          expect.objectContaining({ user_id: "profile-a" }),
          { authenticatedUserId: "account-a" },
        );
      }

      await switchAccount(screen, <DetailsStep />);
      await settleMutation(() => request.resolve(tournament));

      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
      expect(mockResetDraft).not.toHaveBeenCalled();
      expect(queryClient.setQueryData).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("does not expose a late failure to the replacement account", async () => {
      const request = deferred<TournamentWithPnL>();
      const mutation =
        kind === "create" ? mockCreateTournament : mockUpdateTournament;
      mutation.mockReturnValue(request.promise);
      const screen = await renderSaveScreen(kind);

      fireEvent.press(screen.getByTestId("submit-tournament"));
      await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
      await switchAccount(screen, <DetailsStep />);
      await settleMutation(() =>
        request.reject(new Error(`${kind} failed for A`)),
      );

      expect(screen.queryByText(`${kind} failed for A`)).toBeNull();
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
      expect(mockResetDraft).not.toHaveBeenCalled();
      expect(queryClient.setQueryData).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  },
);

describe("delete tournament auth isolation", () => {
  it("binds the request to the initiating user and ignores late success after an account switch", async () => {
    const request = deferred<{ success: boolean }>();
    mockDeleteTournament.mockReturnValue(request.promise);
    const screen = await startDelete();

    expect(mockDeleteTournament).toHaveBeenCalledWith(tournament.id, {
      authenticatedUserId: "account-a",
    });

    await switchAccount(screen, <TournamentDetailScreen />);
    await settleMutation(() => request.resolve({ success: true }));

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not expose a late failure to the replacement account", async () => {
    const request = deferred<{ success: boolean }>();
    mockDeleteTournament.mockReturnValue(request.promise);
    const screen = await startDelete();

    await switchAccount(screen, <TournamentDetailScreen />);
    await settleMutation(() =>
      request.reject(new Error("delete failed for A")),
    );

    expect(screen.queryByText("delete failed for A")).toBeNull();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

it("allows same-user token refresh while a tournament save is pending", async () => {
  const request = deferred<TournamentWithPnL>();
  mockCreateTournament.mockReturnValue(request.promise);
  const screen = await renderSaveScreen("create");

  fireEvent.press(screen.getByTestId("submit-tournament"));
  await waitFor(() => expect(mockCreateTournament).toHaveBeenCalledTimes(1));
  mockAuthState = authState("account-a", "profile-a", "refreshed-token");
  screen.rerender(<DetailsStep />);
  await settleMutation(() => request.resolve(tournament));
  await waitFor(() => expect(screen.getByTestId("view-saved-projection")).toBeTruthy());

  expect(mockResetDraft).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId("view-saved-projection"));
  fireEvent.press(screen.getByTestId("dismiss-saved-projection"));

  expect(mockCreateTournament).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: "profile-a" }),
    { authenticatedUserId: "account-a" },
  );
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["tournaments", "profile-a"],
  });
  expect(queryClient.getQueryData(["tournament", tournament.id])).toEqual(tournament);
  expect(queryClient.getQueryState(["tournament", tournament.id])?.isInvalidated).toBe(false);
  expect(mockResetDraft).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith(`/tournaments/${tournament.id}`);
  expect(mockReplace).toHaveBeenCalledTimes(1);
});

it("locks builder editing while a save mutation is pending", async () => {
  const request = deferred<TournamentWithPnL>();
  mockCreateTournament.mockReturnValue(request.promise);
  const screen = await renderSaveScreen("create");

  fireEvent.press(screen.getByTestId("submit-tournament"));
  await waitFor(() => expect(mockCreateTournament).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByTestId("edit-builder-while-saving"));

  expect(mockBuilderEdit).not.toHaveBeenCalled();
  await settleMutation(() => request.resolve(tournament));
  expect(mockResetDraft).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

it.each(["create", "update"] as const)(
  "opens the saved %s response without fetching tournament details again",
  async (kind) => {
    const saved = { ...tournament, name: "Saved tournament" };
    const mutation = kind === "create" ? mockCreateTournament : mockUpdateTournament;
    mutation.mockResolvedValue(saved);
    const screen = await renderSaveScreen(kind);
    const readsBeforeSave = mockGetTournament.mock.calls.length;

    fireEvent.press(screen.getByTestId("submit-tournament"));
    await screen.findByTestId("view-saved-projection");
    mockParams = { id: saved.id };
    screen.rerender(<TournamentDetailScreen />);

    expect(await screen.findByText(saved.name)).toBeTruthy();
    expect(mockGetTournament).toHaveBeenCalledTimes(readsBeforeSave);
    expect(queryClient.getQueryData(["tournament", saved.id])).toEqual(saved);
    expect(mockResetDraft).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["tournaments", "profile-a"],
    });
  },
);

it("does not cache a saved projection if the account changes during query cancellation", async () => {
  const cancellation = deferred<void>();
  const cancelQueries = jest.spyOn(queryClient, "cancelQueries")
    .mockReturnValueOnce(cancellation.promise);
  mockCreateTournament.mockResolvedValue(tournament);
  const screen = await renderSaveScreen("create");
  fireEvent.press(screen.getByTestId("submit-tournament"));
  await waitFor(() => expect(cancelQueries).toHaveBeenCalledTimes(1));

  await switchAccount(screen, <DetailsStep />);
  await settleMutation(() => cancellation.resolve());

  expect(queryClient.setQueryData).not.toHaveBeenCalled();
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  expect(mockResetDraft).not.toHaveBeenCalled();
  expect(screen.queryByTestId("view-saved-projection")).toBeNull();
});
