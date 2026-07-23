import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api";
import {
  detailsSchema,
  prizesSchema,
  spendingSchema,
  subsidySchema,
  toTournamentPreviewPayload,
  travelSchema,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import { formatMoney, roundLabels, scenarioLabel } from "@/lib/utils";
import type { Scenario } from "@/types";

const scenarios: Scenario[] = ["worst", "realistic", "best"];

const styles = StyleSheet.create({
  scenarioCard: {
    minHeight: 126,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
});

function canPreview(draft: TournamentDraft) {
  return [detailsSchema, prizesSchema, travelSchema, subsidySchema, spendingSchema].every(
    (schema) => schema.safeParse(draft).success,
  );
}

function netPresentation(net: number, currency: string) {
  if (net === 0) {
    return { label: "Break even", value: formatMoney(0, currency), color: colors.foreground };
  }

  return {
    label: net > 0 ? "Projected gain" : "Projected loss",
    value: `${net > 0 ? "+" : "−"}${formatMoney(Math.abs(net), currency)}`,
    color: net > 0 ? colors.profit : colors.loss,
  };
}

export function ScenarioStrip({
  authenticatedUserId,
  draft,
  homeCurrency,
  identityResolved,
  profileId,
}: {
  authenticatedUserId: string;
  draft: TournamentDraft;
  homeCurrency: string;
  identityResolved: boolean;
  profileId: string;
}) {
  const draftReady = canPreview(draft);
  const crossCurrency =
    draft.currency.toUpperCase() !== homeCurrency.toUpperCase();
  const previewReady = identityResolved && draftReady && !crossCurrency;
  const serializedPayload = previewReady
    ? JSON.stringify(toTournamentPreviewPayload(draft, profileId))
    : "";
  const debouncedPayload = useDebouncedValue(serializedPayload, 350);
  const waitingForDebounce =
    previewReady && serializedPayload !== debouncedPayload;
  const {
    data,
    error,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["tournament-pnl-preview", homeCurrency.toUpperCase(), debouncedPayload],
    queryFn: ({ signal }) =>
      api.tournaments.preview(JSON.parse(debouncedPayload), {
        signal,
        authenticatedUserId,
      }),
    enabled: previewReady && Boolean(debouncedPayload) && !waitingForDebounce,
    retry: false,
  });
  const loading = waitingForDebounce || isFetching;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 12,
              fontWeight: "800",
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            Live projection
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "900" }}>
            Outcome scenarios
          </Text>
        </View>
        {loading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
      </View>

      {!previewReady ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            padding: spacing.lg,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            {crossCurrency
              ? `Create the projection to see outcomes converted from ${draft.currency.toUpperCase()} to ${homeCurrency.toUpperCase()}.`
              : identityResolved
                ? "Complete the required tournament details to start a live preview."
                : "Choose the searched tournament or create it before previewing outcomes."}
          </Text>
        </View>
      ) : loading ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            minHeight: 116,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Text style={{ color: colors.mutedForeground }}>Updating from the server…</Text>
        </View>
      ) : isError ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            gap: spacing.sm,
            padding: spacing.lg,
            borderRadius: radii.lg,
            backgroundColor: colors.warningSoft,
          }}
        >
          <Text style={{ color: colors.warning, fontWeight: "800" }}>
            Live preview unavailable
          </Text>
          <Text style={{ color: colors.warning, lineHeight: 20 }}>
            {error.message}. You can keep editing without losing your draft.
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => refetch()}
            style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
          >
            <Text style={{ color: colors.warning, fontWeight: "900" }}>Try preview again</Text>
          </Pressable>
        </View>
      ) : data?.scenarios.length === 0 ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.foreground, fontWeight: "800" }}>
            No outcomes yet
          </Text>
          <Text style={{ color: colors.mutedForeground, lineHeight: 20, marginTop: spacing.xs }}>
            Add prize estimates to see worst, realistic, and best outcomes.
          </Text>
        </View>
      ) : data ? (
        <View
          accessibilityLabel="Worst, realistic, and best projected outcomes"
          style={{ flexDirection: "row", gap: spacing.sm }}
        >
          {scenarios.map((scenario) => {
            const result = data.scenarios.find((item) => item.scenario === scenario);

            if (!result) return null;
            const net = netPresentation(result.net_result, homeCurrency);

            return (
              <View
                key={scenario}
                accessible
                accessibilityLabel={`${scenarioLabel(scenario)} scenario. Outcome ${roundLabels[result.round]}. ${net.label} ${net.value}.`}
                style={[
                  styles.scenarioCard,
                  {
                    borderColor: scenario === "realistic" ? colors.accent : colors.border,
                    backgroundColor:
                      scenario === "realistic" ? colors.accentSoft : colors.surface,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {scenarioLabel(scenario)}
                </Text>
                <View style={{ gap: 2 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Outcome</Text>
                  <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900" }}>
                    {roundLabels[result.round]}
                  </Text>
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{net.label}</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.86}
                    style={{
                      color: net.color,
                      fontSize: 14,
                      fontWeight: "900",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {net.value}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View
          style={{
            padding: spacing.lg,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Text style={{ color: colors.mutedForeground }}>Preview is ready when your edits settle.</Text>
        </View>
      )}
    </View>
  );
}
