import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";

import { ScenarioCard } from "@/components/tournament/scenario-card";
import type { ScenarioResult } from "@/types";

function renderScenarioCard(
  result: ScenarioResult,
  prizeTaxRate?: number,
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
        tournamentCurrency="USD"
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
  net_result: 200,
  profitable: true,
};

describe("ScenarioCard", () => {
  it("annotates net results when prize tax is withheld", () => {
    const screen = renderScenarioCard(scenario, 30);

    expect(screen.getByText("Prize after tax")).toBeTruthy();
    expect(
      screen.getByText("Net is after 30% tax withholding on prize money."),
    ).toBeTruthy();
  });

  it("does not show tax annotation when tax rate is zero", () => {
    const screen = renderScenarioCard(scenario, 0);

    expect(screen.queryByText("Prize after tax")).toBeNull();
    expect(
      screen.queryByText("Net is after 30% tax withholding on prize money."),
    ).toBeNull();
  });
});
