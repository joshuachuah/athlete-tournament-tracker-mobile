import { X } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { ProjectionEditor } from "@/components/tournament/impact-ledger";
import { ProjectionEditorFields } from "@/components/tournament/projection-editor-fields";
import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/constants/theme";
import { useTournamentPreview } from "@/hooks/use-tournament-preview";
import {
  calculateAccommodationTotal,
  deriveDraftDates,
  detailsSchema,
  emptyPrizeRounds,
  prizesSchema,
  spendingSchema,
  subsidySchema,
  travelSchema,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import { zodErrorMap } from "@/lib/zod-errors";

const styles = StyleSheet.create({
  editorScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  editorContent: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingTop: spacing.sm,
  },
});

const editorTitles: Record<ProjectionEditor, { title: string; description: string }> = {
  details: {
    title: "Tournament details",
    description: "Set the identity, dates, currency, and entry fee.",
  },
  prize: {
    title: "Prize money",
    description: "Choose the PSA event details.",
  },
  travel: {
    title: "Travel and stay",
    description: "Add flights and enter accommodation by night or as a total.",
  },
  "daily-spending": {
    title: "Food and local transport",
    description: "Enter daily estimates or totals for the whole tournament.",
  },
  coaching: {
    title: "Coaching / physio",
    description: "Add tournament-specific athlete support costs.",
  },
  misc: {
    title: "Miscellaneous cost",
    description: "Add other costs already supported by the projection.",
  },
  sponsorship: {
    title: "Sponsorship",
    description: "Allocate existing sponsorship to this tournament.",
  },
  subsidy: {
    title: "Subsidy",
    description: "Describe financial support and what it covers.",
  },
};

function schemaForEditor(editor: ProjectionEditor) {
  if (editor === "details") return detailsSchema;
  if (editor === "prize") return prizesSchema;
  if (editor === "travel") return travelSchema;
  if (editor === "subsidy" || editor === "sponsorship") return subsidySchema;
  return spendingSchema;
}

export function ProjectionEditorContent({
  draft,
  editor,
  authenticatedUserId = "",
  homeCurrency = "USD",
  onApply,
  onClose,
  profileId = "",
}: {
  authenticatedUserId?: string;
  draft: TournamentDraft;
  editor: ProjectionEditor;
  homeCurrency?: string;
  onApply: (draft: TournamentDraft) => void;
  onClose: () => void;
  profileId?: string;
}) {
  const [workingDraft, setWorkingDraft] = useState(() => ({
    ...draft,
    prize_rounds: { ...draft.prize_rounds },
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const heading = editorTitles[editor];
  const { data: prizePreview, isLoadingPreview: prizePreviewLoading } =
    useTournamentPreview({
    authenticatedUserId,
    draft: workingDraft,
    enabled:
      editor === "prize" &&
      Boolean(authenticatedUserId) &&
      Boolean(profileId) &&
      prizesSchema.safeParse(workingDraft).success,
    homeCurrency,
    profileId,
  });

  function update(changes: Partial<TournamentDraft>) {
    setWorkingDraft((current) => deriveDraftDates({ ...current, ...changes }));
  }

  function updateAccommodation(changes: {
    accommodation_nightly?: number;
    accommodation_nights?: number;
  }) {
    setWorkingDraft((current) => {
      const nightly = changes.accommodation_nightly ?? current.accommodation_nightly;
      const nights = changes.accommodation_nights ?? current.accommodation_nights;
      return {
        ...current,
        accommodation_nightly: nightly,
        accommodation_nights: nights,
        accommodation_total: calculateAccommodationTotal(nightly, nights, current.currency),
      };
    });
  }

  function apply() {
    const result = schemaForEditor(editor).safeParse(workingDraft);
    if (!result.success) {
      setErrors(zodErrorMap(result.error));
      return;
    }

    const currencyChanged =
      editor === "details" &&
      workingDraft.currency.toUpperCase() !== draft.currency.toUpperCase();
    const createTournamentRenamed =
      editor === "details" &&
      !draft.editId &&
      workingDraft.name.trim() !== draft.name.trim();
    const hasPrizeData =
      workingDraft.prize_tier_id !== null ||
      workingDraft.prize_draw_template_id !== null ||
      workingDraft.prize_player_total > 0 ||
      Object.values(workingDraft.prize_rounds).some((amount) => amount > 0);
    const appliedDraft =
      (currencyChanged && hasPrizeData) || createTournamentRenamed
        ? {
            ...workingDraft,
            prize_distribution_mode: "generated" as const,
            prize_tier_id: null,
            prize_draw_template_id: null,
            prize_player_total: 0,
            prize_rounds: emptyPrizeRounds(),
            prize_tax_rate: createTournamentRenamed
              ? workingDraft.country_code === "US"
                ? 30
                : null
              : workingDraft.prize_tax_rate,
          }
        : workingDraft;

    onApply(deriveDraftDates(appliedDraft));
  }

  return (
    <View style={{ flexShrink: 1 }}>
      <View
        collapsable={false}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xs,
          paddingBottom: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "900" }}>
            {heading.title}
          </Text>
          <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
            {heading.description}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Close ${heading.title} editor`}
          accessibilityRole="button"
          hitSlop={10}
          onPress={onClose}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <X color={colors.foreground} size={24} />
        </Pressable>
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        // Size to the fields so short editors keep their buttons close.
        // Only shrink (and scroll) when the form is taller than the sheet.
        style={styles.editorScroll}
        contentContainerStyle={styles.editorContent}
      >
        <ProjectionEditorFields
          editor={editor}
          errors={errors}
          onUpdate={update}
          onUpdateAccommodation={updateAccommodation}
          prizePreview={prizePreview}
          prizePreviewLoading={prizePreviewLoading}
          workingDraft={workingDraft}
        />
      </ScrollView>

      <View
        style={{
          gap: spacing.sm,
          padding: spacing.lg,
          paddingBottom: spacing.xl,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Button label={`Apply ${heading.title.toLowerCase()}`} onPress={apply} />
        <Button label="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}
