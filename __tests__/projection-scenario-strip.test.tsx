import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { ScenarioStrip } from "@/components/tournament/scenario-strip";
import { api } from "@/lib/api";
import { createDefaultTournamentDraft } from "@/lib/tournament-draft";

jest.mock("@/lib/api", () => ({
  api: { tournaments: { preview: jest.fn() } },
}));

const mockPreview = api.tournaments.preview as jest.Mock;
const draft = {
  ...createDefaultTournamentDraft(new Date(2026, 0, 1)),
  name: "Open",
  location: "Detroit",
  country: "United States",
  country_code: "US" as const,
  prize_rounds: {
    ...createDefaultTournamentDraft().prize_rounds,
    r1: 100,
    r2: 200,
    r3: 300,
    qf: 400,
    sf: 500,
    f: 600,
    w: 700,
  },
};

const previewWithOutcomes = {
  total_expenses: 200,
  total_income_base: 0,
  break_even_round: "r2" as const,
  scenarios: [
    {
      scenario: "worst" as const,
      round: "r1" as const,
      prize_money: 100,
      prize_money_after_tax: 100,
      net_result: -100,
      profitable: false,
    },
    {
      scenario: "realistic" as const,
      round: "r2" as const,
      prize_money: 200,
      prize_money_after_tax: 200,
      net_result: 0,
      profitable: true,
    },
    {
      scenario: "best" as const,
      round: "w" as const,
      prize_money: 700,
      prize_money_after_tax: 700,
      net_result: 500,
      profitable: true,
    },
  ],
};

function renderStrip(currentDraft = draft) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(
    <ScenarioStrip
      authenticatedUserId="account-1"
      draft={currentDraft}
      homeCurrency="USD"
      identityResolved
      profileId="athlete-1"
    />,
    { wrapper: Wrapper },
  );
}

async function settlePreview() {
  await act(async () => {
    jest.advanceTimersByTime(350);
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockPreview.mockReset();
});

afterEach(() => jest.useRealTimers());

it("renders a server-provided non-QF middle case and treats zero net as break-even", async () => {
  mockPreview.mockResolvedValue(previewWithOutcomes);
  const screen = renderStrip({
    ...draft,
    prize_rounds: {
      ...draft.prize_rounds,
      r3: 0,
      qf: 0,
      sf: 0,
      f: 0,
    },
  });
  await settlePreview();

  await waitFor(() => expect(screen.getByText("Out in R2")).toBeTruthy());
  expect(screen.queryByText("QF")).toBeNull();
  expect(screen.getByText("Middle case")).toBeTruthy();
  expect(screen.getByText("Win")).toBeTruthy();
  expect(screen.getByText("$0")).toBeTruthy();
  expect(
    screen.getByLabelText(/scenario\. Out in \w+\. Break even \$0 USD\.$/),
  ).toBeTruthy();
  expect(screen.getByText("Breaks even at R2")).toBeTruthy();
});

it("keeps the last result on screen while a changed draft refetches", async () => {
  let resolveUpdatedPreview:
    | ((value: typeof previewWithOutcomes) => void)
    | undefined;
  mockPreview
    .mockResolvedValueOnce(previewWithOutcomes)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdatedPreview = resolve;
        }),
    );
  const screen = renderStrip();
  await settlePreview();
  await waitFor(() => expect(screen.getByText("+$500")).toBeTruthy());

  screen.rerender(
    <ScenarioStrip
      authenticatedUserId="account-1"
      draft={{ ...draft, entry_fee: 25 }}
      homeCurrency="USD"
      identityResolved
      profileId="athlete-1"
    />,
  );

  expect(screen.getByText("Updating")).toBeTruthy();
  expect(screen.getByText("+$500")).toBeTruthy();

  await settlePreview();
  await act(async () => {
    resolveUpdatedPreview?.({
      ...previewWithOutcomes,
      scenarios: previewWithOutcomes.scenarios.map((scenario) =>
        scenario.scenario === "best"
          ? { ...scenario, net_result: 450 }
          : scenario,
      ),
    });
    await Promise.resolve();
  });

  await waitFor(() => expect(screen.getByText("+$450")).toBeTruthy());
  expect(screen.queryByText("Updating")).toBeNull();
});

it("keeps the last result when a refetch fails", async () => {
  mockPreview
    .mockResolvedValueOnce(previewWithOutcomes)
    .mockRejectedValueOnce(new Error("Preview offline"))
    .mockResolvedValueOnce(previewWithOutcomes);
  const screen = renderStrip();
  await settlePreview();
  await waitFor(() => expect(screen.getByText("+$500")).toBeTruthy());

  screen.rerender(
    <ScenarioStrip
      authenticatedUserId="account-1"
      draft={{ ...draft, entry_fee: 25 }}
      homeCurrency="USD"
      identityResolved
      profileId="athlete-1"
    />,
  );
  await settlePreview();

  await waitFor(() => expect(screen.getByText("Unavailable")).toBeTruthy());
  expect(screen.getByText("Showing the last result.")).toBeTruthy();
  expect(screen.getByText("+$500")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(3));
});

it("shows the explicit empty and unavailable states without blocking edits", async () => {
  mockPreview.mockResolvedValueOnce({
    total_expenses: 0,
    total_income_base: 0,
    scenarios: [],
    break_even_round: null,
  });
  const empty = renderStrip({
    ...draft,
    prize_rounds: createDefaultTournamentDraft().prize_rounds,
  });
  await settlePreview();
  await waitFor(() => expect(empty.getByText("No outcomes yet")).toBeTruthy());
  expect(
    empty.getByText(
      "Choose a supported PSA tier and draw to see worst, middle, and best outcomes.",
    ),
  ).toBeTruthy();

  mockPreview.mockRejectedValueOnce(new Error("Preview offline"));
  const unavailable = renderStrip({ ...draft, entry_fee: 1 });
  await settlePreview();
  await waitFor(() => expect(unavailable.getByText("Live preview unavailable")).toBeTruthy());
  expect(unavailable.getByText(/You can keep editing/)).toBeTruthy();
});

it("explains unavailable outcomes for a non-USD tournament", async () => {
  mockPreview.mockResolvedValue({
    total_expenses: 0,
    total_income_base: 0,
    scenarios: [],
    break_even_round: null,
  });
  const screen = renderStrip({
    ...draft,
    currency: "EUR",
    prize_rounds: createDefaultTournamentDraft().prize_rounds,
  });
  await settlePreview();

  await waitFor(() =>
    expect(screen.getByText("Outcomes unavailable")).toBeTruthy(),
  );
  expect(
    screen.getByText(
      "Official USD payout outcomes are unavailable for this tournament currency.",
    ),
  ).toBeTruthy();
  expect(
    screen.queryByText(
      "Based on your earliest, middle, and latest entered prize rounds.",
    ),
  ).toBeNull();
  expect(screen.queryByText(/Choose a supported PSA tier/)).toBeNull();
  expect(screen.queryByText(/Add prize estimates/)).toBeNull();
});

it("explains a server-backed empty known-tournament schedule", async () => {
  mockPreview.mockResolvedValue({
    total_expenses: 0,
    total_income_base: 0,
    scenarios: [],
    break_even_round: null,
  });
  const screen = renderStrip({
    ...draft,
    prize_distribution_mode: "manual",
    prize_rounds: createDefaultTournamentDraft().prize_rounds,
  });
  await settlePreview();

  await waitFor(() => expect(screen.getByText("No outcomes yet")).toBeTruthy());
  expect(
    screen.getByText("No payout schedule was supplied with this tournament."),
  ).toBeTruthy();
  expect(screen.queryByText(/Choose a supported PSA tier/)).toBeNull();
});

it("cancels the stale preview request when the debounced draft changes", async () => {
  mockPreview.mockImplementation(
    (_payload: unknown, options: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  );
  const screen = renderStrip();
  await settlePreview();
  const firstSignal = mockPreview.mock.calls[0][1].signal as AbortSignal;

  screen.rerender(
    <ScenarioStrip
      authenticatedUserId="account-1"
      draft={{ ...draft, entry_fee: 25 }}
      homeCurrency="USD"
      identityResolved
      profileId="athlete-1"
    />,
  );
  await settlePreview();

  expect(firstSignal.aborted).toBe(true);
  expect(mockPreview).toHaveBeenCalledTimes(2);
});

it("previews cross-currency outcomes in the athlete's home currency", async () => {
  mockPreview.mockResolvedValue({
    total_expenses: 90,
    total_income_base: 0,
    break_even_round: "qf",
    scenarios: [
      { scenario: "worst", round: "r1", prize_money: 90, prize_money_after_tax: 90, net_result: 0, profitable: false },
    ],
  });
  const screen = renderStrip({ ...draft, currency: "EUR" });
  await settlePreview();

  await waitFor(() => expect(screen.getAllByText("$0").length).toBeGreaterThan(0));
  expect(screen.getAllByText("USD").length).toBeGreaterThan(0);
  expect(mockPreview).toHaveBeenCalledWith(
    expect.objectContaining({ currency: "EUR", user_id: "athlete-1" }),
    expect.objectContaining({ authenticatedUserId: "account-1" }),
  );
});

it("keys the preview cache by home currency", async () => {
  mockPreview.mockResolvedValue({
    total_expenses: 100,
    total_income_base: 0,
    scenarios: [],
    break_even_round: null,
  });
  const screen = renderStrip();
  await settlePreview();
  await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));

  screen.rerender(
    <ScenarioStrip
      authenticatedUserId="account-1"
      draft={{ ...draft, currency: "MYR" }}
      homeCurrency="MYR"
      identityResolved
      profileId="athlete-1"
    />,
  );

  await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2));
});
