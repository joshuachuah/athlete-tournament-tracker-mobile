import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { LoadingState } from "@/components/ui/state";
import { WizardNav, WizardShell } from "@/components/tournament/wizard-shell";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useTournamentDraft } from "@/context/tournament-draft";
import { api } from "@/lib/api";
import {
  defaultTournamentDraft,
  detailsSchema,
  tournamentToDraft,
} from "@/lib/tournament-draft";
import { zodErrorMap } from "@/lib/zod-errors";

export default function DetailsStep() {
  const { session } = useAuth();
  const { draft, setDraft, updateDraft } = useTournamentDraft();
  const params = useLocalSearchParams<{
    editId?: string;
    name?: string;
    location?: string;
    country?: string;
    currency?: string;
    start_date?: string;
    end_date?: string;
    duration_days?: string;
    prize_rounds?: string;
  }>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  const editId = typeof params.editId === "string" ? params.editId : undefined;
  const editTournament = useQuery({
    queryKey: ["tournament", editId],
    queryFn: () => api.tournaments.get(editId ?? ""),
    enabled: Boolean(editId),
  });

  useEffect(() => {
    if (editTournament.data && hydratedKey !== `edit:${editTournament.data.id}`) {
      setDraft(tournamentToDraft(editTournament.data));
      setHydratedKey(`edit:${editTournament.data.id}`);
    }
  }, [editTournament.data, hydratedKey, setDraft]);

  useEffect(() => {
    if (editId || hydratedKey !== null) {
      return;
    }

    // Fresh wizard entry (from scratch or prefilled via search). Always start
    // from a clean draft rather than building on whatever was persisted, so a
    // leftover draft from an abandoned edit can't leak in — in particular so a
    // stale editId can't silently update the previously-edited tournament.
    const next = { ...defaultTournamentDraft };
    if (params.name) next.name = String(params.name);
    if (params.location) next.location = String(params.location);
    if (params.country) next.country = String(params.country);
    if (params.currency) next.currency = String(params.currency).toUpperCase();
    if (params.start_date) next.start_date = String(params.start_date);
    if (params.end_date) next.end_date = String(params.end_date);
    if (params.duration_days) next.duration_days = Number(params.duration_days);
    if (params.prize_rounds) {
      try {
        next.prize_rounds = {
          ...defaultTournamentDraft.prize_rounds,
          ...JSON.parse(String(params.prize_rounds)),
        };
      } catch {
        // Ignore malformed prefill data from navigation params.
      }
    }

    setDraft(next);
    setHydratedKey("prefill");
  }, [
    editId,
    hydratedKey,
    params.country,
    params.currency,
    params.duration_days,
    params.end_date,
    params.location,
    params.name,
    params.prize_rounds,
    params.start_date,
    setDraft,
  ]);

  if (!session) {
    return <Redirect href="/login" />;
  }

  function handleNext() {
    const result = detailsSchema.safeParse(draft);

    if (!result.success) {
      setErrors(zodErrorMap(result.error));
      return;
    }

    setErrors({});
    router.push("/tournaments/new/prizes");
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
      <WizardShell step="details">
        {editTournament.isLoading ? <LoadingState label="Loading tournament" /> : null}
        <View style={{ gap: spacing.lg }}>
          <Input
            label="Tournament name"
            value={draft.name}
            onChangeText={(name) => updateDraft({ name })}
            error={errors.name}
          />
          <Input
            label="Location"
            value={draft.location}
            onChangeText={(location) => updateDraft({ location })}
            error={errors.location}
          />
          <Input
            label="Country"
            value={draft.country}
            onChangeText={(country) => updateDraft({ country })}
            error={errors.country}
          />
          <Input
            label="Currency"
            value={draft.currency}
            maxLength={3}
            autoCapitalize="characters"
            onChangeText={(currency) => updateDraft({ currency: currency.toUpperCase() })}
            error={errors.currency}
          />
          <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
            <Input
              label="Start date"
              value={draft.start_date}
              onChangeText={(start_date) => updateDraft({ start_date })}
              error={errors.start_date}
              style={{ minWidth: 150 }}
            />
            <Input
              label="End date"
              value={draft.end_date}
              onChangeText={(end_date) => updateDraft({ end_date })}
              error={errors.end_date}
              style={{ minWidth: 150 }}
            />
          </View>
          <Text style={{ color: colors.mutedForeground }} selectable>
            Duration: {draft.duration_days} day{draft.duration_days === 1 ? "" : "s"}
          </Text>
          <MoneyInput
            label={`Entry fee (${draft.currency})`}
            value={draft.entry_fee}
            onChangeValue={(entry_fee) => updateDraft({ entry_fee })}
            error={errors.entry_fee}
          />
          <WizardNav onNext={handleNext} />
        </View>
      </WizardShell>
    </ScrollView>
  );
}
