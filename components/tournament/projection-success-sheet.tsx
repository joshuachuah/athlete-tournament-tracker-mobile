import { Check, X } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { colors, radii, spacing } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatMoney, getScenario, roundLabels } from "@/lib/utils";
import type { TournamentWithPnL } from "@/types";

function netText(amount: number, currency: string) {
  if (amount === 0) return `Break even · ${formatMoney(0, currency)}`;
  return `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount), currency)}`;
}

export function ProjectionSuccessSheet({
  onDismiss,
  onView,
  mode,
  tournament,
}: {
  onDismiss: () => void;
  onView: () => void;
  mode: "create" | "edit";
  tournament: TournamentWithPnL;
}) {
  const reducedMotion = useReducedMotion();
  const realistic = getScenario(tournament, "realistic");
  const title = mode === "edit" ? "Projection updated" : "Projection saved";
  const resultVerb = mode === "edit" ? "updated" : "saved";

  return (
    <Modal
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
      transparent
      visible
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityLabel={`Dismiss ${resultVerb} projection`}
          accessibilityRole="button"
          onPress={onDismiss}
          style={{ flex: 1, backgroundColor: "rgba(14, 16, 18, 0.34)" }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={`${tournament.name} projection ${resultVerb}`}
          style={{
            gap: spacing.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xxl,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 22,
                backgroundColor: colors.profit,
              }}
            >
              <Check color="#FFFFFF" size={25} strokeWidth={3} />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "900" }}>
                {title}
              </Text>
              <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
                {mode === "edit"
                  ? `${tournament.name} changes now use the server’s latest tax-aware P&L.`
                  : `${tournament.name} now uses the server’s latest tax-aware P&L.`}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Dismiss ${resultVerb} projection`}
              accessibilityRole="button"
              hitSlop={10}
              onPress={onDismiss}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <X color={colors.foreground} size={24} />
            </Pressable>
          </View>

          <View
            style={{
              gap: spacing.md,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.lg,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            {realistic ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                <View style={{ gap: 3 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Realistic outcome</Text>
                  <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900" }}>
                    {roundLabels[realistic.round]}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Net</Text>
                  <Text
                    style={{
                      color:
                        realistic.net_result > 0
                          ? colors.profit
                          : realistic.net_result < 0
                            ? colors.loss
                            : colors.foreground,
                      fontSize: 18,
                      fontWeight: "900",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {netText(realistic.net_result, tournament.home_currency)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
                No outcome scenarios were returned because no prize estimates were added.
              </Text>
            )}
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
              <Text style={{ color: colors.mutedForeground }}>Total expenses</Text>
              <Text style={{ color: colors.foreground, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
                {formatMoney(tournament.pnl.total_expenses, tournament.home_currency)}
              </Text>
            </View>
          </View>

          <Button label="View projection" onPress={onView} />
        </View>
      </View>
    </Modal>
  );
}
