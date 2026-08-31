import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import {
  formatDate,
  formatMoney,
  formatMoneyParts,
  roundLabels,
  scenarioLabel,
} from "@/lib/utils";
import type {
  ActualPnl,
  PnLResult,
  ScenarioResult,
  TournamentResult,
} from "@/types";

type OutcomeStatus =
  | { kind: "live" }
  | { kind: "saved" }
  | { kind: "updating" }
  | { kind: "unavailable" };

type OutcomeBody =
  | {
      kind: "projection";
      pnl: PnLResult;
      homeCurrency: string;
      faded?: boolean;
    }
  | { kind: "completed"; result: TournamentResult; actualPnl: ActualPnl }
  | { kind: "message"; children: ReactNode; minHeight?: number };

const scenarioOrder = ["worst", "realistic", "best"] as const;

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    boxShadow:
      "0 1px 2px rgba(16, 23, 18, 0.03), 0 12px 28px -18px rgba(16, 23, 18, 0.24)",
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerTitle: {
    minWidth: 0,
    flex: 1,
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  status: {
    flexShrink: 0,
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  statusRow: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  projectionRows: {
    gap: spacing.md,
  },
  scenarioRow: {
    gap: spacing.sm,
  },
  scenarioLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  scenarioName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
  },
  scenarioRound: {
    marginLeft: spacing.sm,
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  labelSpacer: {
    flex: 1,
    minWidth: spacing.sm,
  },
  amountGroup: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  scenarioAmount: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  scenarioCode: {
    marginLeft: spacing.xs,
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "700",
  },
  barTrack: {
    height: 22,
    // The design calls for a tighter radius than the smallest shared token.
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
  },
  barFill: {
    height: "100%",
    borderRadius: 6,
  },
  breakEven: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakEvenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakEvenText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700",
  },
  breakEvenCosts: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  completedBody: {
    gap: spacing.xs,
  },
  completedLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "700",
  },
  completedAmount: {
    fontSize: 32,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  completedAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  completedCode: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "700",
  },
  completedRound: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
  },
  completedSummary: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  message: {
    padding: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  footer: {
    marginTop: spacing.md,
  },
});

/** Bar widths as a share of the largest absolute net. Layout only. */
export function barFills(scenarios: ScenarioResult[]): number[] {
  const largestNet = Math.max(
    0,
    ...scenarios.map((scenario) => Math.abs(scenario.net_result)),
  );

  if (largestNet === 0) {
    return scenarios.map(() => 3);
  }

  return scenarios.map((scenario) =>
    Math.max(3, (Math.abs(scenario.net_result) / largestNet) * 100),
  );
}

function statusContent(status: OutcomeStatus) {
  if (status.kind === "updating") {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
        <Text style={styles.status}>Updating</Text>
      </View>
    );
  }

  const label =
    status.kind === "saved"
      ? "Saved projection"
      : status.kind === "unavailable"
        ? "Unavailable"
        : "Live projection";

  return (
    <Text
      style={[
        styles.status,
        status.kind === "unavailable" ? { color: colors.warning } : null,
      ]}
    >
      {label}
    </Text>
  );
}

function ProjectionBody({
  faded,
  homeCurrency,
  pnl,
}: Extract<OutcomeBody, { kind: "projection" }>) {
  const orderedScenarios = scenarioOrder.flatMap((scenario) => {
    const result = pnl.scenarios.find((item) => item.scenario === scenario);
    return result ? [result] : [];
  });
  const fills = barFills(orderedScenarios);
  const hasBreakEven = pnl.break_even_round !== null;
  const breakEvenText = pnl.break_even_round
    ? `Breaks even at ${roundLabels[pnl.break_even_round]}`
    : "Doesn't break even at any round";
  const costsText = `after ${formatMoney(pnl.total_expenses, homeCurrency)} costs`;

  return (
    <View style={faded ? { opacity: 0.45 } : null}>
      <View
        accessibilityLabel="Worst, middle, and best projected outcomes"
        style={styles.projectionRows}
      >
        {orderedScenarios.map((result, index) => {
          const parts = formatMoneyParts(
            Math.abs(result.net_result),
            homeCurrency,
          );
          const sign =
            result.net_result > 0 ? "+" : result.net_result < 0 ? "−" : "";
          const amount = `${sign}${parts.amount}`;
          const roundText =
            result.round === "w"
              ? "Win"
              : `Out in ${roundLabels[result.round]}`;
          const netLabel =
            result.net_result > 0
              ? "Projected gain"
              : result.net_result < 0
                ? "Projected loss"
                : "Break even";

          return (
            <View
              key={result.scenario}
              accessible
              accessibilityLabel={`${scenarioLabel(result.scenario)} scenario. ${roundText}. ${netLabel} ${amount} ${parts.code}.`}
              style={styles.scenarioRow}
            >
              <View style={styles.scenarioLabelRow}>
                <Text style={styles.scenarioName}>
                  {scenarioLabel(result.scenario)}
                </Text>
                <Text style={styles.scenarioRound}>{roundText}</Text>
                <View style={styles.labelSpacer} />
                <View style={styles.amountGroup}>
                  <Text
                    style={[
                      styles.scenarioAmount,
                      result.net_result < 0 ? { color: colors.loss } : null,
                    ]}
                  >
                    {amount}
                  </Text>
                  <Text style={styles.scenarioCode}>{parts.code}</Text>
                </View>
              </View>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.barTrack}
              >
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${fills[index]}%`,
                      backgroundColor:
                        result.net_result < 0 ? colors.loss : colors.profit,
                      opacity:
                        result.net_result < 0 ||
                        result.scenario === "realistic"
                          ? 1
                          : 0.35,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View
        accessible
        accessibilityLabel={`${breakEvenText}. ${costsText}.`}
        style={styles.breakEven}
      >
        <View
          style={[
            styles.breakEvenDot,
            {
              backgroundColor: hasBreakEven ? colors.profit : colors.border,
            },
          ]}
        />
        <Text
          style={[
            styles.breakEvenText,
            hasBreakEven ? null : { color: colors.mutedForeground },
          ]}
        >
          {breakEvenText}
        </Text>
        <View style={styles.labelSpacer} />
        <Text style={styles.breakEvenCosts}>{costsText}</Text>
      </View>
    </View>
  );
}

function CompletedBody({
  actualPnl,
  result,
}: Extract<OutcomeBody, { kind: "completed" }>) {
  const label =
    actualPnl.net_result > 0
      ? "Final profit"
      : actualPnl.net_result < 0
        ? "Final loss"
        : "Final break-even";
  const parts = formatMoneyParts(
    Math.abs(actualPnl.net_result),
    actualPnl.home_currency,
  );
  const sign =
    actualPnl.net_result > 0 ? "+" : actualPnl.net_result < 0 ? "−" : "";
  const amount = `${sign}${parts.amount}`;
  const round =
    result.achieved_round === "w"
      ? "Champion"
      : `Out in ${roundLabels[result.achieved_round]}`;
  const summary = `Income ${formatMoney(actualPnl.total_income, actualPnl.home_currency)} · Expenses ${formatMoney(actualPnl.total_expenses, actualPnl.home_currency)}`;

  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${amount} ${parts.code}. ${round}. ${summary}`}
      style={styles.completedBody}
    >
      <Text selectable style={styles.completedLabel}>
        {label}
      </Text>
      <View style={styles.completedAmountRow}>
        <Text
          selectable
          style={[
            styles.completedAmount,
            {
              color:
                actualPnl.net_result > 0
                  ? colors.profit
                  : actualPnl.net_result < 0
                    ? colors.loss
                    : colors.foreground,
            },
          ]}
        >
          {amount}
        </Text>
        <Text selectable style={styles.completedCode}>
          {parts.code}
        </Text>
      </View>
      <Text selectable style={styles.completedRound}>
        {round}
      </Text>
      <Text selectable style={styles.completedSummary}>
        {summary}
      </Text>
    </View>
  );
}

export function OutcomeCard({
  body,
  footer,
  status,
}: {
  body: OutcomeBody;
  /** Rendered inside the card after the body. */
  footer?: ReactNode;
  status: OutcomeStatus;
}) {
  const completed = body.kind === "completed";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {completed ? "Final outcome" : "Outcome scenarios"}
        </Text>
        <View accessibilityLiveRegion="polite">
          {completed ? (
            <Text style={styles.status}>
              Completed {formatDate(body.result.completed_at)}
            </Text>
          ) : (
            statusContent(status)
          )}
        </View>
      </View>

      {body.kind === "projection" ? (
        <ProjectionBody {...body} />
      ) : body.kind === "completed" ? (
        <CompletedBody {...body} />
      ) : (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.message, { minHeight: body.minHeight }]}
        >
          {body.children}
        </View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}
