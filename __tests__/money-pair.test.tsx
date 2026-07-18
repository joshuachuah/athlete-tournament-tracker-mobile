import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react-native";
import { View } from "react-native";

import { MoneyPair } from "@/components/tournament/money-pair";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/utils";

jest.mock("@/lib/api", () => ({
  api: {
    fx: {
      convert: jest.fn(),
    },
  },
}));

const convert = api.fx.convert as jest.MockedFunction<typeof api.fx.convert>;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });
}

function renderMoneyPairs(
  pairs: Array<{
    amount: number;
    fromCurrency: string;
    toCurrency: string;
  }>,
) {
  const queryClient = createQueryClient();
  const screen = render(
    <QueryClientProvider client={queryClient}>
      <View>
        {pairs.map((pair) => (
          <MoneyPair
            key={`${pair.fromCurrency}:${pair.toCurrency}:${pair.amount}`}
            {...pair}
          />
        ))}
      </View>
    </QueryClientProvider>,
  );

  return { queryClient, screen };
}

describe("MoneyPair", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shares one normalized unit-rate request across different amounts", async () => {
    convert.mockResolvedValue({ converted: 999, rate: 0.915 });

    const { screen } = renderMoneyPairs([
      { amount: 0, fromCurrency: "usd", toCurrency: "eur" },
      { amount: 100, fromCurrency: "USD", toCurrency: "EUR" },
      { amount: 12.34, fromCurrency: "Usd", toCurrency: "Eur" },
    ]);

    await waitFor(() => {
      expect(screen.getByText(formatMoney(91.5, "EUR"))).toBeTruthy();
    });

    expect(screen.getByText(formatMoney(0, "EUR"))).toBeTruthy();
    expect(screen.getByText(formatMoney(11.29, "EUR"))).toBeTruthy();
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith(
      "USD",
      "EUR",
      1,
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it("uses separate requests for inverse and different currency pairs", async () => {
    convert.mockImplementation(async (from, to) => ({
      converted: 1,
      rate: from === "EUR" && to === "USD" ? 2 : 0.5,
    }));

    const { screen } = renderMoneyPairs([
      { amount: 10, fromCurrency: "USD", toCurrency: "EUR" },
      { amount: 20, fromCurrency: "EUR", toCurrency: "USD" },
      { amount: 30, fromCurrency: "USD", toCurrency: "JPY" },
    ]);

    await waitFor(() => {
      expect(convert).toHaveBeenCalledTimes(3);
      expect(screen.queryByText("Converting...")).toBeNull();
    });

    expect(convert.mock.calls.map(([from, to, amount]) => [from, to, amount])).toEqual(
      expect.arrayContaining([
        ["USD", "EUR", 1],
        ["EUR", "USD", 1],
        ["USD", "JPY", 1],
      ]),
    );
  });

  it.each([
    ["JPY", 100.4, 1, 100],
    ["EUR", 0.915, 1.005, 0.92],
    ["KWD", 0.12345, 10, 1.235],
  ])(
    "rounds display conversion to %s precision",
    async (toCurrency, rate, amount, expected) => {
      convert.mockResolvedValue({ converted: -1, rate });

      const { screen } = renderMoneyPairs([
        { amount, fromCurrency: "USD", toCurrency },
      ]);

      await waitFor(() => {
        expect(screen.getByText(formatMoney(expected, toCurrency))).toBeTruthy();
      });
      expect(convert).toHaveBeenCalledTimes(1);
    },
  );

  it("shows loading and then the locally converted amount", async () => {
    let resolveConversion!: (value: { converted: number; rate: number }) => void;
    convert.mockReturnValue(
      new Promise((resolve) => {
        resolveConversion = resolve;
      }),
    );

    const { screen } = renderMoneyPairs([
      { amount: 10, fromCurrency: "USD", toCurrency: "EUR" },
    ]);

    expect(screen.getByText("Converting...")).toBeTruthy();

    resolveConversion({ converted: 999, rate: 0.5 });

    await waitFor(() => {
      expect(screen.getByText(formatMoney(5, "EUR"))).toBeTruthy();
    });
  });

  it("shows the existing fallback when the rate request fails", async () => {
    convert.mockRejectedValue(new Error("offline"));

    const { screen } = renderMoneyPairs([
      { amount: 10, fromCurrency: "USD", toCurrency: "EUR" },
    ]);

    await waitFor(() => {
      expect(screen.getByText("FX unavailable")).toBeTruthy();
    });
  });

  it.each([0, Number.NaN])("rejects an unusable server rate of %s", async (rate) => {
    convert.mockResolvedValue({ converted: 0, rate });

    const { screen } = renderMoneyPairs([
      { amount: 10, fromCurrency: "USD", toCurrency: "EUR" },
    ]);

    await waitFor(() => {
      expect(screen.getByText("FX unavailable")).toBeTruthy();
    });
  });

  it("does not request FX for equal currencies or non-finite amounts", () => {
    const { screen } = renderMoneyPairs([
      { amount: 10, fromCurrency: "usd", toCurrency: "USD" },
      { amount: Number.NaN, fromCurrency: "USD", toCurrency: "EUR" },
      { amount: Number.POSITIVE_INFINITY, fromCurrency: "USD", toCurrency: "EUR" },
    ]);

    expect(screen.queryByText("Converting...")).toBeNull();
    expect(convert).not.toHaveBeenCalled();
  });
});
