import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react-native";

import { ScenarioCard } from "@/components/tournament/scenario-card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { ScenarioResult } from "@/types";

jest.mock("@/lib/api", () => ({
  api: {
    fx: {
      convert: jest.fn(),
    },
  },
}));

const convert = api.fx.convert as jest.MockedFunction<typeof api.fx.convert>;

function renderScenarioCard(
  result: ScenarioResult,
  prizeTaxRate?: number,
  tournamentCurrency = "USD",
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ScenarioCard
        result={result}
        homeCurrency="USD"
        tournamentCurrency={tournamentCurrency}
        prizeTaxRate={prizeTaxRate}
      />
    </QueryClientProvider>,
  );
}

const scenario: ScenarioResult = {
  scenario: "best",
  round: "w",
  prize_money: 1000,
  prize_money_after_tax: 700,
  prize_money_after_estimated_withholding: 700,
  net_result: 200,
  profitable: true,
};

describe("ScenarioCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("annotates net results when prize tax is withheld", () => {
    const screen = renderScenarioCard(scenario, 30);

    expect(screen.getByText("Prize after estimated withholding")).toBeTruthy();
    expect(
      screen.getByText(
        "Net uses a 30% estimated withholding rate on prize money.",
      ),
    ).toBeTruthy();
  });

  it("renders the server-provided after amount for a confirmed zero rate", () => {
    const screen = renderScenarioCard(scenario, 0);

    expect(screen.getByText("Prize after estimated withholding")).toBeTruthy();
    expect(screen.getByText(formatMoney(700, "USD"))).toBeTruthy();
    expect(
      screen.getByText("Net uses a 0% estimated withholding rate on prize money."),
    ).toBeTruthy();
  });

  it("shows gross only while the withholding rate is unknown", () => {
    const screen = renderScenarioCard(scenario);

    expect(screen.queryByText("Prize after estimated withholding")).toBeNull();
    expect(screen.queryByText(/estimated withholding rate/)).toBeNull();
  });

  it("falls back to the legacy after-tax amount during API rollout", () => {
    const {
      prize_money_after_estimated_withholding: _newWithholdingAmount,
      ...legacyScenario
    } = scenario;
    const screen = renderScenarioCard(legacyScenario, 30);

    expect(screen.getByText(formatMoney(700, "USD"))).toBeTruthy();
  });

  it("shares one rate request across tax-bearing scenario amounts", async () => {
    convert.mockResolvedValue({ converted: 0.5, rate: 0.5 });

    const screen = renderScenarioCard(scenario, 30, "EUR");

    await waitFor(() => {
      expect(screen.getByText(formatMoney(500, "EUR"))).toBeTruthy();
    });

    expect(screen.getByText(formatMoney(1000, "USD"))).toBeTruthy();
    expect(screen.getByText(formatMoney(350, "EUR"))).toBeTruthy();
    expect(screen.getByText(formatMoney(100, "EUR"))).toBeTruthy();
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith(
      "USD",
      "EUR",
      1,
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });
});
