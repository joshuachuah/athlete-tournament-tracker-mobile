import { notifyManager, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { Alert } from "react-native";

import { TournamentResultSheet } from "@/components/tournament/tournament-result-sheet";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import type { ActualPnl, TournamentWithPnL } from "@/types";

let mockCurrentUserId = "user-1";

jest.mock("@/context/auth", () => ({
  useAuth: () => ({
    isCurrentUser: (userId: string) => userId === mockCurrentUserId,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

jest.mock("@/lib/api", () => ({
  api: {
    tournaments: {
      previewResult: jest.fn(),
      removeResult: jest.fn(),
      upsertResult: jest.fn(),
    },
  },
}));

const mockPreviewResult = api.tournaments.previewResult as jest.MockedFunction<
  typeof api.tournaments.previewResult
>;
const mockUpsertResult = api.tournaments.upsertResult as jest.MockedFunction<
  typeof api.tournaments.upsertResult
>;
const mockRemoveResult = api.tournaments.removeResult as jest.MockedFunction<
  typeof api.tournaments.removeResult
>;

const actualPnl: ActualPnl = {
  total_expenses: 800,
  total_income: 600,
  prize_received: 500,
  net_result: -200,
  profitable: false,
  home_currency: "USD",
};

const tournament: TournamentWithPnL = {
  id: "tournament-1",
  user_id: "user-1",
  name: "US Open",
  location: "Detroit",
  country: "United States",
  country_code: "US",
  currency: "USD",
  start_date: "2026-08-01",
  end_date: "2026-08-03",
  duration_days: 3,
  entry_fee: 100,
  flight_cost: 200,
  accommodation_total: 300,
  food_total: 120,
  local_transport_total: 80,
  daily_spending_cap: 0,
  coaching_cost: 25,
  misc_cost: 10,
  subsidy_by: "Club",
  subsidy_amount: 50,
  subsidy_covers: "flat_stipend",
  sponsorship_allocated: 75,
  prize_rounds: { qf: 700, w: 1500 },
  prize_tax_rate: 30,
  created_at: "2026-07-01T00:00:00Z",
  home_currency: "USD",
  pnl: {
    total_income_base: 75,
    total_expenses: 835,
    scenarios: [
      {
        scenario: "realistic",
        round: "qf",
        prize_money: 700,
        prize_money_after_tax: 490,
        net_result: -270,
        profitable: false,
      },
    ],
    break_even_round: "w",
    prize_rounds_after_estimated_withholding: { qf: 490, w: 1050 },
  },
};

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderSheet(onClose = jest.fn()) {
  return {
    onClose,
    screen: render(
      <TournamentResultSheet
        authenticatedUserId="user-1"
        onClose={onClose}
        profileId="profile-1"
        tournament={tournament}
      />,
      { wrapper: Wrapper },
    ),
  };
}

describe("TournamentResultSheet", () => {
  beforeAll(() => {
    notifyManager.setNotifyFunction((callback) => {
      act(callback);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    queryClient.setDefaultOptions({
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity },
    });
    mockPreviewResult.mockResolvedValue(actualPnl);
    mockCurrentUserId = "user-1";
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("offers every exit round and prefills the received prize estimate and planned totals", async () => {
    const { screen } = renderSheet();

    expect(screen.getByRole("radio", { name: "R1" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Champion" })).toBeTruthy();
    expect(screen.getByLabelText("Prize received (USD)").props.value).toBe("490");
    expect(screen.getByLabelText("Food total (USD)").props.value).toBe("120");
    expect(screen.getByLabelText("Local transport total (USD)").props.value).toBe("80");
    expect(screen.getByLabelText("Accommodation total (USD)").props.value).toBe("300");

    expect(await screen.findByText("-$200 USD")).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Result preview, loss, -$200 USD. Income $600 USD. Expenses $800 USD.",
      ),
    ).toBeTruthy();
    expect(mockPreviewResult).toHaveBeenCalledWith(
      tournament.id,
      expect.not.objectContaining({ completed_at: expect.anything() }),
      expect.objectContaining({ authenticatedUserId: "user-1" }),
    );
  });

  it("requires confirmation, saves the server-previewed input, and invalidates both result consumers", async () => {
    const saved = { ...tournament, actual_pnl: actualPnl };
    const onClose = jest.fn();
    mockUpsertResult.mockResolvedValue(saved);
    const detailInvalidation = jest.spyOn(queryClient, "invalidateQueries");
    const { screen } = renderSheet(onClose);

    await screen.findByText("-$200 USD");
    expect(screen.getByRole("button", { name: "Record result" }).props.accessibilityState.disabled).toBe(true);

    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "I confirm these are the actual amounts",
      }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Record result" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockUpsertResult).toHaveBeenCalledWith(
      tournament.id,
      expect.objectContaining({
        achieved_round: "qf",
        prize_received_total: 490,
        food_total: 120,
        local_transport_total: 80,
      }),
      { authenticatedUserId: "user-1" },
    );
    expect(detailInvalidation).toHaveBeenCalledWith({
      queryKey: ["tournament", tournament.id],
      exact: true,
    });
    expect(detailInvalidation).toHaveBeenCalledWith({
      queryKey: ["tournaments", "profile-1"],
    });
  });

  it("clears confirmation and hides an old preview while changed values debounce", async () => {
    const { screen } = renderSheet();

    await screen.findByText("-$200 USD");
    jest.useFakeTimers();
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "I confirm these are the actual amounts",
      }),
    );

    fireEvent.changeText(screen.getByLabelText("Prize received (USD)"), "650");

    expect(
      screen.getByRole("checkbox", {
        name: "I confirm these are the actual amounts",
      }).props.accessibilityState.checked,
    ).toBe(false);
    expect(screen.queryByText("-$200 USD")).toBeNull();
    expect(screen.getByText("Calculating final result")).toBeTruthy();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(350);
    });
    expect(mockPreviewResult).toHaveBeenLastCalledWith(
      tournament.id,
      expect.objectContaining({ prize_received_total: 650 }),
      expect.any(Object),
    );
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
  });

  it("cancels an older preview request when the input changes", async () => {
    jest.useFakeTimers();
    let firstSignal: AbortSignal | undefined;
    mockPreviewResult
      .mockImplementationOnce((_id, _input, options) => {
        firstSignal = options?.signal;
        return new Promise((_resolve, reject) => {
          firstSignal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      })
      .mockResolvedValueOnce(actualPnl);
    const { screen } = renderSheet();

    await waitFor(() => expect(mockPreviewResult).toHaveBeenCalledTimes(1));
    fireEvent.changeText(screen.getByLabelText("Prize received (USD)"), "650");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(350);
    });

    expect(firstSignal?.aborted).toBe(true);
    expect(await screen.findByText("-$200 USD")).toBeTruthy();
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });
  });

  it("edits without replacing the confirmed prize and can remove the saved result", async () => {
    const completed = {
      ...tournament,
      result: {
        id: "result-1",
        tournament_id: tournament.id,
        user_id: "user-1",
        achieved_round: "qf" as const,
        completed_at: "2026-08-03",
        prize_received_total: 515,
        subsidy_received_total: 50,
        sponsorship_received_total: 75,
        entry_fee_total: 100,
        flight_total: 200,
        accommodation_total: 300,
        food_total: 120,
        local_transport_total: 80,
        coaching_total: 25,
        misc_total: 10,
        created_at: "2026-08-03T00:00:00Z",
        updated_at: "2026-08-03T00:00:00Z",
      },
      actual_pnl: actualPnl,
    };
    mockRemoveResult.mockResolvedValue({
      ...tournament,
      result: null,
      actual_pnl: null,
    });
    const onClose = jest.fn();
    const screen = render(
      <TournamentResultSheet
        authenticatedUserId="user-1"
        onClose={onClose}
        profileId="profile-1"
        tournament={completed}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByLabelText("Prize received (USD)").props.value).toBe("515");
    fireEvent.press(screen.getByRole("radio", { name: "Champion" }));
    expect(screen.getByLabelText("Prize received (USD)").props.value).toBe("515");

    fireEvent.press(screen.getByRole("button", { name: "Remove result" }));
    const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    const removeAction = actions?.find((action) => action.text === "Remove");
    act(() => removeAction?.onPress?.());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockRemoveResult).toHaveBeenCalledWith(tournament.id, {
      authenticatedUserId: "user-1",
    });
  });

  it("requires older unsplit daily spending to be accounted for explicitly", async () => {
    const { screen } = renderSheet();
    screen.rerender(
      <TournamentResultSheet
        authenticatedUserId="user-1"
        onClose={jest.fn()}
        profileId="profile-1"
        tournament={{ ...tournament, daily_spending_cap: 25 }}
      />,
    );

    expect(
      screen.getByText(/older projection includes \$75 USD of unsplit daily spending/),
    ).toBeTruthy();
    const confirmation = screen.getByRole("checkbox", {
      name: "I confirm these are the actual amounts",
    });
    expect(confirmation.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "I accounted for the older daily spending",
      }),
    );
    fireEvent.press(confirmation);
    await screen.findByText("-$200 USD");
    expect(
      screen.getByRole("button", { name: "Record result" }).props
        .accessibilityState.disabled,
    ).toBe(false);
  });

  it("cross-disables result mutations while a save is pending", async () => {
    let resolveSave: ((value: TournamentWithPnL) => void) | undefined;
    mockUpsertResult.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const completed = {
      ...tournament,
      result: {
        id: "result-1",
        tournament_id: tournament.id,
        user_id: "user-1",
        achieved_round: "qf" as const,
        completed_at: "2026-08-03",
        prize_received_total: 515,
        subsidy_received_total: 50,
        sponsorship_received_total: 75,
        entry_fee_total: 100,
        flight_total: 200,
        accommodation_total: 300,
        food_total: 120,
        local_transport_total: 80,
        coaching_total: 25,
        misc_total: 10,
        created_at: "2026-08-03T00:00:00Z",
        updated_at: "2026-08-03T00:00:00Z",
      },
      actual_pnl: actualPnl,
    };
    const screen = render(
      <TournamentResultSheet
        authenticatedUserId="user-1"
        onClose={jest.fn()}
        profileId="profile-1"
        tournament={completed}
      />,
      { wrapper: Wrapper },
    );

    await screen.findByText("-$200 USD");
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "I confirm these are the actual amounts",
      }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Save result" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove result" }).props
          .accessibilityState.disabled,
      ).toBe(true),
    );
    await act(async () => {
      resolveSave?.(completed);
      await Promise.resolve();
    });
  });

  it("ignores a late save after the signed-in account changes", async () => {
    let resolveSave: ((value: TournamentWithPnL) => void) | undefined;
    mockUpsertResult.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const onClose = jest.fn();
    const { screen } = renderSheet(onClose);

    await screen.findByText("-$200 USD");
    fireEvent.press(
      screen.getByRole("checkbox", {
        name: "I confirm these are the actual amounts",
      }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Record result" }));
    mockCurrentUserId = "user-2";
    await act(async () => resolveSave?.({ ...tournament, actual_pnl: actualPnl }));

    expect(onClose).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["tournament", tournament.id])).toBeUndefined();
  });
});
