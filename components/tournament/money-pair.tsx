import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { colors, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/utils";

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
  const shouldConvert =
    fromCurrency.toUpperCase() !== toCurrency.toUpperCase() && Number.isFinite(amount);

  const conversion = useQuery({
    queryKey: ["fx", fromCurrency, toCurrency, amount],
    queryFn: () => api.fx.convert(fromCurrency, toCurrency, amount),
    enabled: shouldConvert,
    staleTime: 60 * 60 * 1000,
  });

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
        {formatMoney(amount, fromCurrency)}
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
          {conversion.data
            ? formatMoney(conversion.data.converted, toCurrency)
            : conversion.isError
              ? "FX unavailable"
              : "Converting..."}
        </Text>
      ) : null}
    </View>
  );
}
