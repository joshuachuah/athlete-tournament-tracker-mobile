import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { MoneyInput } from "@/components/ui/money-input";
import { WizardNav, WizardShell } from "@/components/tournament/wizard-shell";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useTournamentDraft } from "@/context/tournament-draft";
import { prizesSchema } from "@/lib/tournament-draft";
import { roundLabels } from "@/lib/utils";
import { zodErrorMap } from "@/lib/zod-errors";
import type { PrizeRounds } from "@/types";

const rounds: (keyof PrizeRounds)[] = ["r1", "r2", "r3", "qf", "sf", "f", "w"];

export default function PrizesStep() {
  const { session } = useAuth();
  const { draft, updateDraft } = useTournamentDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!session) {
    return <Redirect href="/login" />;
  }

  function handleNext() {
    const result = prizesSchema.safeParse(draft);

    if (!result.success) {
      setErrors(zodErrorMap(result.error));
      return;
    }

    setErrors({});
    router.push("/tournaments/new/travel");
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
      <WizardShell step="prizes">
        <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
          Prize amounts are entered in tournament currency. The server converts
          and calculates P&L in your home currency.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {rounds.map((round) => (
            <MoneyInput
              key={round}
              label={`${roundLabels[round]} (${draft.currency})`}
              value={draft.prize_rounds[round]}
              onChangeValue={(amount) =>
                updateDraft({
                  prize_rounds: {
                    ...draft.prize_rounds,
                    [round]: amount,
                  },
                })
              }
              error={errors[`prize_rounds.${round}`]}
              style={{ minWidth: 135 }}
            />
          ))}
        </View>
        <View style={{ gap: spacing.xs }}>
          <MoneyInput
            label="Prize tax withholding %"
            value={draft.prize_tax_rate}
            onChangeValue={(amount) =>
              updateDraft({
                prize_tax_rate: amount,
              })
            }
            error={errors.prize_tax_rate}
            style={{ maxWidth: 220 }}
          />
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }} selectable>
            Most events withhold 15–30% for visiting athletes.
          </Text>
        </View>
        <WizardNav showBack onNext={handleNext} />
      </WizardShell>
    </ScrollView>
  );
}
