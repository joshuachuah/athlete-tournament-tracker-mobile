import { Redirect, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { MoneyInput } from "@/components/ui/money-input";
import { WizardNav, WizardShell } from "@/components/tournament/wizard-shell";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useTournamentDraft } from "@/context/tournament-draft";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import {
  detailsSchema,
  prizesSchema,
  spendingSchema,
  subsidySchema,
  toTournamentPayload,
  travelSchema,
} from "@/lib/tournament-draft";
import { formatMoney } from "@/lib/utils";
import { zodErrorMap } from "@/lib/zod-errors";

export default function SpendingStep() {
  const { profile, session } = useAuth();
  const { draft, resetDraft, updateDraft } = useTournamentDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile) {
        throw new Error("Save a profile before creating a tournament.");
      }

      const payload = toTournamentPayload(draft, profile.id);

      if (draft.editId) {
        return api.tournaments.update(draft.editId, payload);
      }

      return api.tournaments.create(payload);
    },
    onSuccess: (savedTournament) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["tournament", savedTournament.id] });
      resetDraft();
      router.replace(`/tournaments/${savedTournament.id}`);
    },
    onError: (error) => setSubmitError((error as Error).message),
  });

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile) {
    return <Redirect href="/onboarding" />;
  }

  function validateFullDraft() {
    const schemas = [
      detailsSchema,
      prizesSchema,
      travelSchema,
      subsidySchema,
      spendingSchema,
    ];

    const nextErrors = schemas.reduce<Record<string, string>>((allErrors, schema) => {
      const result = schema.safeParse(draft);
      return result.success ? allErrors : { ...allErrors, ...zodErrorMap(result.error) };
    }, {});

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit() {
    setSubmitError(null);

    if (!validateFullDraft()) {
      setSubmitError("Complete all required wizard fields before submitting.");
      return;
    }

    mutation.mutate();
  }

  const plannedExtrasPerDay =
    draft.duration_days > 0
      ? (draft.coaching_cost + draft.misc_cost) / draft.duration_days
      : 0;
  const overCap =
    draft.daily_spending_cap > 0 && plannedExtrasPerDay > draft.daily_spending_cap;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <WizardShell step="spending">
        <View style={{ gap: spacing.lg }}>
          <MoneyInput
            label={`Daily spending cap (${draft.currency})`}
            value={draft.daily_spending_cap}
            onChangeValue={(daily_spending_cap) =>
              updateDraft({ daily_spending_cap })
            }
            error={errors.daily_spending_cap}
          />
          <MoneyInput
            label={`Coaching / physio (${draft.currency})`}
            value={draft.coaching_cost}
            onChangeValue={(coaching_cost) => updateDraft({ coaching_cost })}
            error={errors.coaching_cost}
          />
          <MoneyInput
            label={`Misc (${draft.currency})`}
            value={draft.misc_cost}
            onChangeValue={(misc_cost) => updateDraft({ misc_cost })}
            error={errors.misc_cost}
          />

          {overCap ? (
            <Text
              style={{
                color: colors.warning,
                backgroundColor: colors.warningSoft,
                padding: spacing.md,
                borderRadius: 8,
                overflow: "hidden",
                lineHeight: 20,
              }}
              selectable
            >
              Planned extras average {formatMoney(plannedExtrasPerDay, draft.currency)}
              per day, above the cap.
            </Text>
          ) : null}

          {submitError ? (
            <Text style={{ color: colors.loss, lineHeight: 20 }} selectable>
              {submitError}
            </Text>
          ) : null}

          <WizardNav
            showBack
            nextLabel={draft.editId ? "Save changes" : "Generate projection"}
            loading={mutation.isPending}
            onNext={handleSubmit}
          />
        </View>
      </WizardShell>
    </ScrollView>
  );
}
