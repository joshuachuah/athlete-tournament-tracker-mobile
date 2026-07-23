import { act, render, waitFor } from "@testing-library/react-native";
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
  prize_rounds: { r1: 100, r2: 200, r3: 300, qf: 400, sf: 500, f: 600, w: 700 },
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

it("renders server-provided dynamic rounds and treats zero net as break-even", async () => {
  mockPreview.mockResolvedValue({
    total_expenses: 400,
    total_income_base: 0,
    break_even_round: "qf",
    scenarios: [
      { scenario: "worst", round: "r1", prize_money: 100, prize_money_after_tax: 100, net_result: -300, profitable: false },
      { scenario: "realistic", round: "qf", prize_money: 400, prize_money_after_tax: 400, net_result: 0, profitable: false },
      { scenario: "best", round: "w", prize_money: 700, prize_money_after_tax: 700, net_result: 300, profitable: true },
    ],
  });
  const screen = renderStrip();
  await settlePreview();

  await waitFor(() => expect(screen.getByText("QF")).toBeTruthy());
  expect(screen.getByText("Win")).toBeTruthy();
  expect(screen.getByText("Break even")).toBeTruthy();
  expect(screen.getByText("$0 USD")).toBeTruthy();
});

it("shows the explicit empty and unavailable states without blocking edits", async () => {
  mockPreview.mockResolvedValueOnce({
    total_expenses: 0,
    total_income_base: 0,
    scenarios: [],
    break_even_round: null,
  });
  const empty = renderStrip();
  await settlePreview();
  await waitFor(() => expect(empty.getByText("No outcomes yet")).toBeTruthy());

  mockPreview.mockRejectedValueOnce(new Error("Preview offline"));
  const unavailable = renderStrip({ ...draft, entry_fee: 1 });
  await settlePreview();
  await waitFor(() => expect(unavailable.getByText("Live preview unavailable")).toBeTruthy());
  expect(unavailable.getByText(/You can keep editing/)).toBeTruthy();
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

it("waits until save for server-converted cross-currency outcomes", async () => {
  const screen = renderStrip({ ...draft, currency: "EUR" });
  await settlePreview();

  expect(mockPreview).not.toHaveBeenCalled();
  expect(
    screen.getByText("Create the projection to see outcomes converted from EUR to USD."),
  ).toBeTruthy();
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
