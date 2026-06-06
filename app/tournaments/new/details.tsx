import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  deriveDraftDates,
  tournamentToDraft,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import { zodErrorMap } from "@/lib/zod-errors";

type DetailsParams = {
  editId?: string;
  name?: string;
  location?: string;
  country?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: string;
  prize_rounds?: string;
};

function draftFromParams(params: DetailsParams): TournamentDraft {
  const next = {
    ...defaultTournamentDraft,
    prize_rounds: { ...defaultTournamentDraft.prize_rounds },
  };

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
        ...next.prize_rounds,
        ...JSON.parse(String(params.prize_rounds)),
      };
    } catch {
      // Ignore malformed prefill data from navigation params.
    }
  }

  return deriveDraftDates(next);
}

function DetailsForm({ initialDraft }: { initialDraft: TournamentDraft }) {
  const { setDraft } = useTournamentDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formDraft, setFormDraft] = useState(() => initialDraft);

  function updateFormDraft(changes: Partial<TournamentDraft>) {
    const next = deriveDraftDates({ ...formDraft, ...changes });
    setFormDraft(next);
    setDraft(next);
  }

  function handleNext() {
    const result = detailsSchema.safeParse(formDraft);

    if (!result.success) {
      setErrors(zodErrorMap(result.error));
      return;
    }

    setErrors({});
    setDraft(formDraft);
    router.push("/tournaments/new/prizes");
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Input
        label="Tournament name"
        value={formDraft.name}
        onChangeText={(name) => updateFormDraft({ name })}
        error={errors.name}
      />
      <Input
        label="Location"
        value={formDraft.location}
        onChangeText={(location) => updateFormDraft({ location })}
        error={errors.location}
      />
      <Input
        label="Country"
        value={formDraft.country}
        onChangeText={(country) => updateFormDraft({ country })}
        error={errors.country}
      />
      <Input
        label="Currency"
        value={formDraft.currency}
        maxLength={3}
        autoCapitalize="characters"
        onChangeText={(currency) =>
          updateFormDraft({ currency: currency.toUpperCase() })
        }
        error={errors.currency}
      />
      <View style={{ flexDirection: "row", gap: spacing.md, flexWrap: "wrap" }}>
        <Input
          label="Start date"
          value={formDraft.start_date}
          onChangeText={(start_date) => updateFormDraft({ start_date })}
          error={errors.start_date}
          style={{ minWidth: 150 }}
        />
        <Input
          label="End date"
          value={formDraft.end_date}
          onChangeText={(end_date) => updateFormDraft({ end_date })}
          error={errors.end_date}
          style={{ minWidth: 150 }}
        />
      </View>
      <Text style={{ color: colors.mutedForeground }} selectable>
        Duration: {formDraft.duration_days} day
        {formDraft.duration_days === 1 ? "" : "s"}
      </Text>
      <MoneyInput
        label={`Entry fee (${formDraft.currency})`}
        value={formDraft.entry_fee}
        onChangeValue={(entry_fee) => updateFormDraft({ entry_fee })}
        error={errors.entry_fee}
      />
      <WizardNav onNext={handleNext} />
    </View>
  );
}

export default function DetailsStep() {
  const { session } = useAuth();
  const params = useLocalSearchParams<DetailsParams>();
  const editId = typeof params.editId === "string" ? params.editId : undefined;
  const editTournament = useQuery({
    queryKey: ["tournament", editId],
    queryFn: () => api.tournaments.get(editId ?? ""),
    enabled: Boolean(editId),
  });

  if (!session) {
    return <Redirect href="/login" />;
  }

  const initialDraft = editTournament.data
    ? tournamentToDraft(editTournament.data)
    : draftFromParams(params);
  const formKey = editTournament.data
    ? `edit:${editTournament.data.id}`
    : `prefill:${JSON.stringify([
        params.name,
        params.location,
        params.country,
        params.currency,
        params.start_date,
        params.end_date,
        params.duration_days,
        params.prize_rounds,
      ])}`;

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
        {!editId || editTournament.data ? (
          <DetailsForm key={formKey} initialDraft={initialDraft} />
        ) : null}
      </WizardShell>
    </ScrollView>
  );
}
