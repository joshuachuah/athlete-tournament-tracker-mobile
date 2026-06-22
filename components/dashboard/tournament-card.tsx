import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScenarioBar } from "@/components/dashboard/scenario-bar";
import { colors, radii, spacing } from "@/constants/theme";
import type { TournamentWithPnL } from "@/types";
import { formatDate, formatMoney, getScenario, roundLabels } from "@/lib/utils";

export function TournamentCard({ tournament }: { tournament: TournamentWithPnL }) {
  const realistic = getScenario(tournament, "realistic");
  const netResult = realistic?.net_result ?? 0;
  const breakEven = tournament.pnl.break_even_round;

  return (
    <Link href={`/tournaments/${tournament.id}`} asChild>
      <Pressable>
        {({ pressed }) => (
          <Card
            style={{
              opacity: pressed ? 0.75 : 1,
              borderRadius: radii.lg,
              padding: spacing.md,
              boxShadow:
                "0 1px 2px rgba(14, 16, 18, 0.03), 0 8px 18px -12px rgba(14, 16, 18, 0.12)",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                <Text
                  style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}
                  numberOfLines={2}
                  selectable
                >
                  {tournament.name}
                </Text>
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}
                  numberOfLines={2}
                  selectable
                >
                  {tournament.location} · {formatDate(tournament.start_date)}
                </Text>
              </View>
              <Badge
                label={formatMoney(netResult, tournament.home_currency)}
                tone={netResult >= 0 ? "profit" : "loss"}
                style={{ maxWidth: "42%" }}
              />
            </View>

            <ScenarioBar tournament={tournament} />

            <Text
              style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}
              selectable
            >
              Break-even: {breakEven ? roundLabels[breakEven] : "No break-even round"}
            </Text>
          </Card>
        )}
      </Pressable>
    </Link>
  );
}
