import { X } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  calculateAccommodationTotal,
  deriveDraftDates,
  detailsSchema,
  prizesSchema,
  spendingSchema,
  subsidySchema,
  travelSchema,
  type TournamentDraft,
} from "@/lib/tournament-draft";
import { zodErrorMap } from "@/lib/zod-errors";

const styles = StyleSheet.create({
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
    description: "Add flights and calculate accommodation from nightly cost.",
  },
  "daily-spending": {
    title: "Daily spending cap",
    description: "Set a maximum day-to-day tournament spend.",
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

function emptyPrizeRounds(): TournamentDraft["prize_rounds"] {
  return { r1: 0, r2: 0, r3: 0, qf: 0, sf: 0, f: 0, w: 0 };
}

export function ProjectionEditorSheet({
  draft,
  editor,
  onApply,
  onClose,
}: {
  draft: TournamentDraft;
  editor: ProjectionEditor;
  onApply: (draft: TournamentDraft) => void;
  onClose: () => void;
}) {
  const [workingDraft, setWorkingDraft] = useState(() => ({
    ...draft,
    prize_rounds: { ...draft.prize_rounds },
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reducedMotion = useReducedMotion();
  const heading = editorTitles[editor];

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
    const hasSelectorPayouts =
      workingDraft.prize_tier_id !== null ||
      workingDraft.prize_draw_template_id !== null ||
      workingDraft.prize_player_total > 0;
    const appliedDraft =
      currencyChanged && hasSelectorPayouts
        ? {
            ...workingDraft,
            prize_tier_id: null,
            prize_draw_template_id: null,
            prize_player_total: 0,
            prize_rounds: emptyPrizeRounds(),
          }
        : workingDraft;

    onApply(deriveDraftDates(appliedDraft));
  }

  return (
    <Modal
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityLabel={`Close ${heading.title} editor`}
          accessibilityRole="button"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(14, 16, 18, 0.34)" }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "88%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.md,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xl,
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
            contentContainerStyle={styles.editorContent}
          >
            <ProjectionEditorFields
              editor={editor}
              errors={errors}
              onUpdate={update}
              onUpdateAccommodation={updateAccommodation}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}
