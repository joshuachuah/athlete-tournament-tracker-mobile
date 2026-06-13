import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { MoneyInput } from "@/components/ui/money-input";
import { WizardNav, WizardShell } from "@/components/tournament/wizard-shell";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useTournamentDraft } from "@/context/tournament-draft";
import { travelSchema } from "@/lib/tournament-draft";
import { roundToCents } from "@/lib/utils";
import { zodErrorMap } from "@/lib/zod-errors";

export default function TravelStep() {
  const { session } = useAuth();
  const { draft, updateDraft } = useTournamentDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!session) {
    return <Redirect href="/login" />;
  }

  function updateAccommodation(changes: {
    accommodation_nightly?: number;
    accommodation_nights?: number;
  }) {
    const accommodation_nightly =
      changes.accommodation_nightly ?? draft.accommodation_nightly;
    const accommodation_nights =
      changes.accommodation_nights ?? draft.accommodation_nights;

    updateDraft({
      accommodation_nightly,
      accommodation_nights,
      accommodation_total: roundToCents(
        accommodation_nightly * accommodation_nights,
      ),
    });
  }

  function handleNext() {
    const result = travelSchema.safeParse(draft);

    if (!result.success) {
      setErrors(zodErrorMap(result.error));
      return;
    }

    setErrors({});
    router.push("/tournaments/new/subsidy");
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <WizardShell step="travel">
        <View style={{ gap: spacing.lg }}>
          <MoneyInput
            label={`Flights (${draft.currency})`}
            value={draft.flight_cost}
            onChangeValue={(flight_cost) => updateDraft({ flight_cost })}
            error={errors.flight_cost}
          />
          <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
            <MoneyInput
              label={`Nightly (${draft.currency})`}
              value={draft.accommodation_nightly}
              onChangeValue={(value) =>
                updateAccommodation({ accommodation_nightly: value })
              }
              error={errors.accommodation_nightly}
              style={{ minWidth: 145 }}
            />
            <MoneyInput
              label="Nights"
              value={draft.accommodation_nights}
              onChangeValue={(value) =>
                updateAccommodation({ accommodation_nights: value })
              }
              error={errors.accommodation_nights}
              style={{ minWidth: 145 }}
            />
          </View>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
            selectable
          >
            Accommodation total: {draft.accommodation_total} {draft.currency}
          </Text>
          <WizardNav
            backHref="/tournaments/new/prizes"
            onNext={handleNext}
          />
        </View>
      </WizardShell>
    </ScrollView>
  );
}
