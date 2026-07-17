import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { router, useLocalSearchParams } from "expo-router";

import TournamentDetailScreen from "@/app/tournaments/[id]";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import type {
  AthleteProfile,
  ScenarioResult,
  TournamentWithPnL,
} from "@/types";

jest.mock("expo-router", () => ({
  Redirect: () => null,
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("@/context/auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  api: {
    fx: {
      convert: jest.fn(),
    },
    tournaments: {
      delete: jest.fn(),
      get: jest.fn(),
    },
  },
}));

const mockDelete = api.tournaments.delete as jest.MockedFunction<
  typeof api.tournaments.delete
>;
const mockReplace = router.replace as jest.Mock;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLocalSearchParams =
  useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

const profile: AthleteProfile = {
  id: "athlete-1",
  email: "athlete@example.com",
  name: "Alex Athlete",
  home_country: "United States",
  home_currency: "USD",
  sport: "Squash",
  monthly_income: 0,
  savings_balance: 0,
  monthly_sponsorship: 0,
  created_at: "2026-01-01",
};

function tournament(id: string): TournamentWithPnL {
  return {
    id,
    user_id: profile.id,
    name: `Tournament ${id}`,
    location: "Detroit",
    country: "United States",
    currency: "USD",
    start_date: "2026-04-01",
    end_date: "2026-04-03",
    duration_days: 3,
    entry_fee: 100,
    flight_cost: 200,
    accommodation_total: 300,
    daily_spending_cap: 75,
    coaching_cost: 0,
    misc_cost: 0,
    subsidy_by: null,
    subsidy_amount: 0,
    subsidy_covers: null,
    sponsorship_allocated: 0,
    prize_rounds: {},
    prize_tax_rate: 0,
    created_at: "2026-01-01",
    home_currency: "USD",
    pnl: {
      total_income_base: 0,
      total_expenses: 825,
      break_even_round: null,
      scenarios: [],
    },
  };
}

function renderDetail(detail: TournamentWithPnL) {
  const listKey = ["tournaments", profile.id] as const;
  const detailKey = ["tournament", detail.id] as const;
  const otherDetail = tournament("other");

  queryClient.setQueryData(listKey, [detail, otherDetail]);
  queryClient.setQueryData(detailKey, detail);
  queryClient.setQueryData(["tournament", otherDetail.id], otherDetail);
  mockUseLocalSearchParams.mockReturnValue({ id: detail.id });

  const screen = render(
    <QueryClientProvider client={queryClient}>
      <TournamentDetailScreen />
    </QueryClientProvider>,
  );

  return { detailKey, listKey, otherDetail, screen };
}

function confirmDelete(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByText("Delete"));

  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const deleteButton = buttons?.find((button) => button.text === "Delete");

  act(() => {
    deleteButton?.onPress?.();
  });
}

const losingScenario: ScenarioResult = {
  scenario: "realistic",
  round: "qf",
  prize_money: 300,
  prize_money_after_tax: 300,
  net_result: -525,
  profitable: false,
};

describe("TournamentDetailScreen deletion", () => {
  beforeEach(() => {
    queryClient.clear();
    queryClient.setDefaultOptions({
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity },
    });
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});

    mockUseLocalSearchParams.mockReturnValue({ id: "deleted" });
    mockUseAuth.mockReturnValue({
      session: {
        access_token: "initiating-token",
        user: { id: profile.id },
      } as Session,
      profile,
      status: "ready",
      authError: null,
      signInWithGoogle: jest.fn(),
      refreshProfile: jest.fn(),
      saveProfile: jest.fn(),
      signOut: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    queryClient.clear();
  });

  it("labels a missing break-even projection as unavailable", async () => {
    const { screen } = renderDetail(tournament("missing-projection"));

    await waitFor(() => {
      expect(screen.getAllByText("Projection unavailable")).toHaveLength(3);
      expect(screen.queryByText("No break-even")).toBeNull();
    });
    screen.unmount();
  });

  it("keeps no-break-even wording when a real projection exists", async () => {
    const detail = tournament("projected-loss");
    detail.pnl.scenarios = [losingScenario];
    const { screen } = renderDetail(detail);

    await waitFor(() => {
      expect(screen.getByText("No break-even")).toBeTruthy();
      expect(screen.queryByText("Projection unavailable")).toBeNull();
    });
    screen.unmount();
  });

  it("evicts only the deleted detail before invalidating its list and routing", async () => {
    const detail = tournament("deleted");
    const { detailKey, listKey, otherDetail, screen } = renderDetail(detail);
    const removeQueries = jest.spyOn(queryClient, "removeQueries");
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");

    mockDelete.mockResolvedValue({ success: true });
    mockReplace.mockImplementation(() => {
      expect(queryClient.getQueryData(detailKey)).toBeUndefined();
      expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
      screen.unmount();
    });

    confirmDelete(screen);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });

    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: detailKey,
      exact: true,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: listKey });
    expect(queryClient.getQueryData(["tournament", otherDetail.id])).toEqual(
      otherDetail,
    );
    expect(removeQueries.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateQueries.mock.invocationCallOrder[0],
    );
    expect(invalidateQueries.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0],
    );
  });

  it("retains cached details and retry UI when deletion fails", async () => {
    const detail = tournament("deleted");
    const { detailKey, listKey, otherDetail, screen } = renderDetail(detail);
    const removeQueries = jest.spyOn(queryClient, "removeQueries");
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");

    mockDelete.mockRejectedValue(new Error("Delete failed"));

    confirmDelete(screen);

    await waitFor(() => {
      expect(screen.getByText("Delete failed")).toBeTruthy();
    });

    expect(screen.getByText("Try again")).toBeTruthy();
    expect(queryClient.getQueryData(detailKey)).toEqual(detail);
    expect(queryClient.getQueryData(["tournament", otherDetail.id])).toEqual(
      otherDetail,
    );
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
    expect(removeQueries).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
