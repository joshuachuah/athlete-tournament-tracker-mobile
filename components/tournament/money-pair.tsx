import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { colors, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { formatMoney, roundCurrencyAmount } from "@/lib/utils";

export function MoneyPair({
  amount,
  fromCurrency,
  toCurrency,
  label,
}: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  label?: string;
}) {
  const normalizedFromCurrency = fromCurrency.toUpperCase();
  const normalizedToCurrency = toCurrency.toUpperCase();
  const shouldConvert =
    normalizedFromCurrency !== normalizedToCurrency && Number.isFinite(amount);

  const { data: rate, isError: conversionFailed } = useQuery({
    queryKey: ["fx-rate", normalizedFromCurrency, normalizedToCurrency],
    queryFn: async ({ signal }) => {
      const conversion = await api.fx.convert(
        normalizedFromCurrency,
        normalizedToCurrency,
        1,
        { signal },
      );

      if (!Number.isFinite(conversion.rate) || conversion.rate <= 0) {
        throw new Error("Invalid FX rate");
      }

      return conversion.rate;
    },
    enabled: shouldConvert,
    staleTime: 60 * 60 * 1000,
  });

  const convertedAmount =
    rate === undefined
      ? undefined
      : roundCurrencyAmount(amount * rate, normalizedToCurrency);

  return (
    <View style={{ gap: 2 }}>
      {label ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }} selectable>
          {label}
        </Text>
      ) : null}
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
        selectable
      >
        {formatMoney(amount, normalizedFromCurrency)}
      </Text>
      {shouldConvert ? (
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 13,
            fontVariant: ["tabular-nums"],
          }}
          selectable
        >
          {convertedAmount !== undefined
            ? formatMoney(convertedAmount, normalizedToCurrency)
            : conversionFailed
              ? "FX unavailable"
              : "Converting..."}
        </Text>
      ) : null}
    </View>
  );
}
