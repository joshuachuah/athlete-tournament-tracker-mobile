import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useTournamentDraft } from "@/context/tournament-draft";
import { subsidySchema } from "@/lib/tournament-draft";
import { zodErrorMap } from "@/lib/zod-errors";
import type { SubsidyCovers } from "@/types";
import { WizardNav, WizardShell } from "@/components/tournament/wizard-shell";

const coverOptions: { value: SubsidyCovers; label: string }[] = [
  { value: "flights", label: "Flights" },
  { value: "accommodation", label: "Accommodation" },
  { value: "full_expenses", label: "Full expenses" },
  { value: "flat_stipend", label: "Flat stipend" },
];

export default function SubsidyStep() {
  const { session } = useAuth();
  const { draft, updateDraft } = useTournamentDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!session) {
    return <Redirect href="/login" />;
  }

  function handleNext() {
    const result = subsidySchema.safeParse(draft);

    if (!result.success) {
      setErrors(zodErrorMap(result.error));
      return;
    }

    setErrors({});
    router.push("/tournaments/new/spending");
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
      <WizardShell step="subsidy">
        <View style={{ gap: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}
                selectable
              >
                I am subsidized
              </Text>
              <Text style={{ color: colors.mutedForeground }} selectable>
                Show subsidy fields only when they apply.
              </Text>
            </View>
            <Switch
              value={draft.subsidy_enabled}
              onValueChange={(subsidy_enabled) => updateDraft({ subsidy_enabled })}
            />
          </View>

          {draft.subsidy_enabled ? (
            <>
              <Input
                label="Subsidy by"
                value={draft.subsidy_by}
                onChangeText={(subsidy_by) => updateDraft({ subsidy_by })}
                error={errors.subsidy_by}
              />
              <MoneyInput
                label={`Subsidy amount (${draft.currency})`}
                value={draft.subsidy_amount}
                onChangeValue={(subsidy_amount) => updateDraft({ subsidy_amount })}
                error={errors.subsidy_amount}
              />
              <View style={{ gap: spacing.sm }}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    fontWeight: "800",
                    textTransform: "uppercase",
                  }}
                >
                  Covers
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {coverOptions.map((option) => (
                    <Button
                      key={option.value}
                      label={option.label}
                      variant={
                        draft.subsidy_covers === option.value ? "primary" : "secondary"
                      }
                      onPress={() => updateDraft({ subsidy_covers: option.value })}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : null}

          <MoneyInput
            label={`Sponsorship allocated (${draft.currency})`}
            value={draft.sponsorship_allocated}
            onChangeValue={(sponsorship_allocated) =>
              updateDraft({ sponsorship_allocated })
            }
            error={errors.sponsorship_allocated}
          />

          <WizardNav
            showBack
            onNext={handleNext}
          />
        </View>
      </WizardShell>
    </ScrollView>
  );
}
