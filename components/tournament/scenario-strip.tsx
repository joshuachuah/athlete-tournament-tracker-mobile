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
  projectionHero: {
    overflow: "hidden",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.brand,
    boxShadow:
      "0 2px 5px rgba(16, 23, 18, 0.10), 0 22px 42px -24px rgba(23, 63, 49, 0.70)",
  },
  scenarioCard: {
    minHeight: 126,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    borderCurve: "continuous",
  },
});

function canPreview(draft: TournamentDraft) {
  return [detailsSchema, prizesSchema, travelSchema, subsidySchema, spendingSchema].every(
    (schema) => schema.safeParse(draft).success,
  );
}

function netPresentation(net: number, currency: string) {
  if (net === 0) {
    return { label: "Break even", value: formatMoney(0, currency) };
  }

  return {
    label: net > 0 ? "Projected gain" : "Projected loss",
    value: `${net > 0 ? "+" : "−"}${formatMoney(Math.abs(net), currency)}`,
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
  const previewReady = identityResolved && draftReady;
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
    <View style={styles.projectionHero}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text
            style={{
              color: colors.brandMutedForeground,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            Live projection
          </Text>
          <Text style={{ color: colors.brandForeground, fontSize: 24, fontWeight: "900" }}>
            Outcome scenarios
          </Text>
          <Text style={{ color: colors.brandMutedForeground, lineHeight: 20 }}>
            Based on your earliest, middle, and latest entered prize rounds.
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.brandForeground} size="small" />
        ) : null}
      </View>

      {!previewReady ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            padding: spacing.lg,
            borderRadius: radii.md,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Text style={{ color: colors.brandMutedForeground, lineHeight: 20 }}>
            {identityResolved
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
            borderRadius: radii.md,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Text style={{ color: colors.brandMutedForeground }}>
            Updating from the server…
          </Text>
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
            borderRadius: radii.md,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Text style={{ color: colors.brandForeground, fontWeight: "800" }}>
            No outcomes yet
          </Text>
          <Text
            style={{
              color: colors.brandMutedForeground,
              lineHeight: 20,
              marginTop: spacing.xs,
            }}
          >
            Add prize estimates to see worst, middle, and best outcomes.
          </Text>
        </View>
      ) : data ? (
        <View
          accessibilityLabel="Worst, middle, and best projected outcomes"
          style={{ flexDirection: "row", gap: spacing.sm }}
        >
          {scenarios.map((scenario) => {
            const result = data.scenarios.find((item) => item.scenario === scenario);

            if (!result) return null;
            const net = netPresentation(result.net_result, homeCurrency);
            const featured = scenario === "realistic";

            return (
              <View
                key={scenario}
                accessible
                accessibilityLabel={`${scenarioLabel(scenario)} scenario. Outcome ${roundLabels[result.round]}. ${net.label} ${net.value}.`}
                style={[
                  styles.scenarioCard,
                  {
                    borderColor: featured
                      ? "rgba(255, 255, 255, 0.42)"
                      : "rgba(255, 255, 255, 0.14)",
                    backgroundColor: featured
                      ? "rgba(255, 255, 255, 0.16)"
                      : "rgba(255, 255, 255, 0.06)",
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.brandMutedForeground,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {scenarioLabel(scenario)}
                </Text>
                <View style={{ gap: 2 }}>
                  <Text style={{ color: colors.brandMutedForeground, fontSize: 12 }}>
                    Outcome
                  </Text>
                  <Text
                    style={{
                      color: colors.brandForeground,
                      fontSize: 18,
                      fontWeight: "900",
                    }}
                  >
                    {roundLabels[result.round]}
                  </Text>
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={{ color: colors.brandMutedForeground, fontSize: 12 }}>
                    {net.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.86}
                    style={{
                      color: colors.brandForeground,
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
            borderRadius: radii.md,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Text style={{ color: colors.brandMutedForeground }}>
            Preview is ready when your edits settle.
          </Text>
        </View>
      )}
    </View>
  );
}
