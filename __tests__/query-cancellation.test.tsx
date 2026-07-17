import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import DashboardScreen from "@/app/(tabs)/dashboard";
import SearchScreen from "@/app/search";
import TournamentDetailScreen from "@/app/tournaments/[id]";
import DetailsStep from "@/app/tournaments/new/details";
import { MoneyPair } from "@/components/tournament/money-pair";
import { api } from "@/lib/api";

const mockUseAuth = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockResetDraft = jest.fn();

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");

  return {
    Link: ({ children }: { children: ReactElement }) => children,
    Redirect: () => null,
    router: {
      push: jest.fn(),
      replace: jest.fn(),
    },
    useLocalSearchParams: () => mockUseLocalSearchParams(),
  };
});

jest.mock("@/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/context/tournament-draft", () => ({
  useTournamentDraft: () => ({
    draft: { editId: undefined },
    resetDraft: mockResetDraft,
  }),
}));

jest.mock("@/lib/api", () => ({
  api: {
    fx: {
      convert: jest.fn(),
    },
    tournaments: {
      delete: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      search: jest.fn(),
    },
  },
}));

const profile = {
  id: "athlete-1",
  email: "athlete@example.com",
  name: "Athlete",
  home_country: "MY",
  home_currency: "MYR",
  sport: "tennis",
  monthly_income: 5_000,
  savings_balance: 10_000,
  monthly_sponsorship: 500,
  created_at: "2026-01-01T00:00:00Z",
};

const mockList = api.tournaments.list as jest.MockedFunction<
  typeof api.tournaments.list
>;
const mockGet = api.tournaments.get as jest.MockedFunction<
  typeof api.tournaments.get
>;
const mockSearch = api.tournaments.search as jest.MockedFunction<
  typeof api.tournaments.search
>;
const mockConvert = api.fx.convert as jest.MockedFunction<typeof api.fx.convert>;

function pendingRequest<T>(): Promise<T> {
  return new Promise(() => undefined);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function renderWithClient(element: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });
  const screen = render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  );

  return { client, screen };
}

function signalFromCall(
  options: { signal?: AbortSignal } | undefined,
): AbortSignal {
  expect(options).toEqual({ signal: expect.any(Object) });
  expect(options?.signal?.aborted).toBe(false);

  return options!.signal!;
}

describe("TanStack query cancellation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ profile, session: { user: { id: "auth-1" } } });
    mockUseLocalSearchParams.mockReturnValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("aborts a superseded search and lets the current request populate cache", async () => {
    jest.useFakeTimers();
    const firstRequest = deferred<never[]>();
    const secondRequest = deferred<
      Array<{ id: string; name: string; location: string }>
    >();
    mockSearch
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const { client, screen } = renderWithClient(<SearchScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Search by tournament name"), "op");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    const firstSignal = signalFromCall(mockSearch.mock.calls[0][2]);
    expect(mockSearch).toHaveBeenNthCalledWith(1, "op", "tennis", {
      signal: firstSignal,
    });

    fireEvent.changeText(
      screen.getByPlaceholderText("Search by tournament name"),
      "open",
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
    const secondSignal = signalFromCall(mockSearch.mock.calls[1][2]);

    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
    expect(mockSearch).toHaveBeenNthCalledWith(2, "open", "tennis", {
      signal: secondSignal,
    });

    const currentResults = [
      { id: "known-1", name: "Open Championship", location: "Kuala Lumpur" },
    ];
    await act(async () => {
      secondRequest.resolve(currentResults);
      await secondRequest.promise;
    });

    await waitFor(() => {
      expect(screen.getByText("Open Championship")).toBeTruthy();
    });
    expect(
      client.getQueryData(["tournament-search", "open", "tennis"]),
    ).toEqual(currentResults);
    expect(screen.queryByText("Something went wrong")).toBeNull();
    expect(screen.queryByText("Request aborted")).toBeNull();

    screen.unmount();
    client.clear();
  });

  it("aborts the dashboard list request on unmount", async () => {
    mockList.mockReturnValue(pendingRequest());
    const { client, screen } = renderWithClient(<DashboardScreen />);

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));
    const signal = signalFromCall(mockList.mock.calls[0][1]);
    expect(mockList).toHaveBeenCalledWith("athlete-1", { signal });

    screen.unmount();

    expect(signal.aborted).toBe(true);
    client.clear();
  });

  it("aborts the tournament detail request on unmount", async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: "tournament-1" });
    mockGet.mockReturnValue(pendingRequest());
    const { client, screen } = renderWithClient(<TournamentDetailScreen />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    const signal = signalFromCall(mockGet.mock.calls[0][1]);
    expect(mockGet).toHaveBeenCalledWith("tournament-1", { signal });

    screen.unmount();

    expect(signal.aborted).toBe(true);
    client.clear();
  });

  it("aborts edit hydration on unmount", async () => {
    mockUseLocalSearchParams.mockReturnValue({ editId: "tournament-2" });
    mockGet.mockReturnValue(pendingRequest());
    const { client, screen } = renderWithClient(<DetailsStep />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    const signal = signalFromCall(mockGet.mock.calls[0][1]);
    expect(mockGet).toHaveBeenCalledWith("tournament-2", { signal });

    screen.unmount();

    expect(signal.aborted).toBe(true);
    client.clear();
  });

  it("aborts an active FX conversion on unmount", async () => {
    mockConvert.mockReturnValue(pendingRequest());
    const { client, screen } = renderWithClient(
      <MoneyPair amount={100} fromCurrency="USD" toCurrency="MYR" />,
    );

    await waitFor(() => expect(mockConvert).toHaveBeenCalledTimes(1));
    const signal = signalFromCall(mockConvert.mock.calls[0][3]);
    expect(mockConvert).toHaveBeenCalledWith("USD", "MYR", 100, { signal });

    screen.unmount();

    expect(signal.aborted).toBe(true);
    client.clear();
  });
});
