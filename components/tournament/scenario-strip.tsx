import { Pressable, Text, View } from "react-native";

import { OutcomeCard } from "@/components/tournament/outcome-card";
import { colors, radii, spacing } from "@/constants/theme";
import { useTournamentPreview } from "@/hooks/use-tournament-preview";
import { errorMessage } from "@/lib/errors";
import { prizeDistributionCurrency } from "@/lib/prize-distributions";
import {
  detailsSchema,
  prizesSchema,
  spendingSchema,
  subsidySchema,
  travelSchema,
  type TournamentDraft,
} from "@/lib/tournament-draft";

function canPreview(draft: TournamentDraft) {
  return [
    detailsSchema,
    prizesSchema,
    travelSchema,
    subsidySchema,
    spendingSchema,
  ].every((schema) => schema.safeParse(draft).success);
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
  const emptyProjectionCopy =
    draft.currency.toUpperCase() !== prizeDistributionCurrency
      ? {
          title: "Outcomes unavailable",
          body: "Official USD payout outcomes are unavailable for this tournament currency.",
        }
      : draft.prize_distribution_mode === "manual"
        ? {
            title: "No outcomes yet",
            body: "No payout schedule was supplied with this tournament.",
          }
        : {
            title: "No outcomes yet",
            body: "Choose a supported PSA tier and draw to see worst, middle, and best outcomes.",
          };
  const {
    data,
    error,
    isError,
    isLoadingPreview: loading,
    lastData,
    refetch,
  } = useTournamentPreview({
    authenticatedUserId,
    draft,
    enabled: previewReady,
    homeCurrency,
    profileId,
  });

  if (!previewReady) {
    return (
      <OutcomeCard
        status={{ kind: "live" }}
        body={{
          kind: "message",
          children: (
            <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
              {identityResolved
                ? "Complete the required tournament details to start a live preview."
                : "Choose the searched tournament or create it before previewing outcomes."}
            </Text>
          ),
        }}
      />
    );
  }

  if (loading && lastData) {
    return (
      <OutcomeCard
        status={{ kind: "updating" }}
        body={{
          kind: "projection",
          pnl: lastData,
          homeCurrency,
          faded: true,
        }}
      />
    );
  }

  if (loading) {
    return (
      <OutcomeCard
        status={{ kind: "live" }}
        body={{
          kind: "message",
          minHeight: 116,
          children: (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.mutedForeground }}>
                Updating projection…
              </Text>
            </View>
          ),
        }}
      />
    );
  }

  if (isError && lastData) {
    return (
      <OutcomeCard
        status={{ kind: "unavailable" }}
        body={{
          kind: "projection",
          pnl: lastData,
          homeCurrency,
          faded: true,
        }}
        footer={
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: colors.warning,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              Showing the last result.
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => refetch()}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: colors.warning, fontWeight: "900" }}>
                Try again
              </Text>
            </Pressable>
          </View>
        }
      />
    );
  }

  if (isError) {
    return (
      <OutcomeCard
        status={{ kind: "live" }}
        body={{
          kind: "message",
          children: (
            <View
              style={{
                gap: spacing.sm,
                margin: -spacing.lg,
                padding: spacing.lg,
                borderRadius: radii.sm,
                backgroundColor: colors.warningSoft,
              }}
            >
              <Text style={{ color: colors.warning, fontWeight: "800" }}>
                Live preview unavailable
              </Text>
              <Text style={{ color: colors.warning, lineHeight: 20 }}>
                {errorMessage(error, "Live preview is unavailable.")} You can
                keep editing without losing your draft.
              </Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => refetch()}
                style={{
                  minHeight: 44,
                  alignSelf: "flex-start",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.warning, fontWeight: "900" }}>
                  Try preview again
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />
    );
  }

  if (data?.scenarios.length === 0) {
    return (
      <OutcomeCard
        status={{ kind: "live" }}
        body={{
          kind: "message",
          children: (
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "800" }}>
                {emptyProjectionCopy.title}
              </Text>
              <Text
                style={{
                  marginTop: spacing.xs,
                  color: colors.mutedForeground,
                  lineHeight: 20,
                }}
              >
                {emptyProjectionCopy.body}
              </Text>
            </View>
          ),
        }}
      />
    );
  }

  if (data) {
    return (
      <OutcomeCard
        status={{ kind: "live" }}
        body={{ kind: "projection", pnl: data, homeCurrency }}
      />
    );
  }

  return (
    <OutcomeCard
      status={{ kind: "live" }}
      body={{
        kind: "message",
        children: (
          <Text style={{ color: colors.mutedForeground }}>
            Preview is ready when your edits settle.
          </Text>
        ),
      }}
    />
  );
}
