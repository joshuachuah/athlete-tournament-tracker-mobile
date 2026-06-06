import { Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import type { Scenario, TournamentWithPnL } from "@/types";
import { getScenario, scenarioLabel } from "@/lib/utils";

const scenarios: Scenario[] = ["worst", "realistic", "best"];

export function ScenarioBar({ tournament }: { tournament: TournamentWithPnL }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {scenarios.map((scenario) => {
          const result = getScenario(tournament, scenario);
          const profitable = (result?.net_result ?? 0) >= 0;

          return (
            <View
              key={scenario}
              style={{
                flex: 1,
                height: 8,
                borderRadius: radii.sm,
                backgroundColor: profitable ? colors.profit : colors.loss,
                opacity: scenario === "realistic" ? 1 : 0.65,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {scenarios.map((scenario) => (
          <Text
            key={scenario}
            style={{
              color: colors.mutedForeground,
              fontSize: 12,
              fontWeight: scenario === "realistic" ? "800" : "600",
            }}
          >
            {scenarioLabel(scenario)}
          </Text>
        ))}
      </View>
    </View>
  );
}
