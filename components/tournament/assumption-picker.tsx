import { Check, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { Input } from "@/components/ui/input";
import { colors, radii, spacing } from "@/constants/theme";
import type { TournamentDraft } from "@/lib/tournament-draft";
import type { AssumptionEditor } from "@/components/tournament/impact-ledger";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const assumptions: Array<{
  editor: AssumptionEditor;
  title: string;
  description: string;
}> = [
  {
    editor: "daily-spending",
    title: "Daily spending cap",
    description: "Food, local travel, and day-to-day spending",
  },
  {
    editor: "coaching",
    title: "Coaching / physio",
    description: "Coaching, physio, or other athlete support",
  },
  {
    editor: "misc",
    title: "Miscellaneous cost",
    description: "Any other tournament-specific expense",
  },
  {
    editor: "sponsorship",
    title: "Sponsorship",
    description: "Existing sponsorship allocated to this event",
  },
  {
    editor: "subsidy",
    title: "Subsidy",
    description: "Support that covers costs or provides a stipend",
  },
];

function isActive(editor: AssumptionEditor, draft: TournamentDraft) {
  switch (editor) {
    case "daily-spending":
      return draft.daily_spending_cap > 0;
    case "coaching":
      return draft.coaching_cost > 0;
    case "misc":
      return draft.misc_cost > 0;
    case "sponsorship":
      return draft.sponsorship_allocated > 0;
    case "subsidy":
      return draft.subsidy_enabled;
  }
}

export function AssumptionPicker({
  draft,
  onClose,
  onSelect,
}: {
  draft: TournamentDraft;
  onClose: () => void;
  onSelect: (editor: AssumptionEditor) => void;
}) {
  const [query, setQuery] = useState("");
  const reducedMotion = useReducedMotion();
  const filtered = assumptions.filter((assumption) =>
    `${assumption.title} ${assumption.description}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

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
          accessibilityLabel="Close assumption picker"
          accessibilityRole="button"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(14, 16, 18, 0.34)" }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "82%",
            gap: spacing.lg,
            padding: spacing.xl,
            paddingBottom: spacing.xxl,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "900" }}>
                Add an assumption
              </Text>
              <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
                Every option maps to a field saved with this projection.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close assumption picker"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <X color={colors.foreground} size={24} />
            </Pressable>
          </View>

          <Input
            label="Search assumptions"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            placeholder="Try sponsorship or coaching"
          />

          <FlatList
            data={filtered}
            keyExtractor={(assumption) => assumption.editor}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item: assumption }) => {
              const active = isActive(assumption.editor, draft);
              return (
                <Pressable
                  accessibilityLabel={`${assumption.title}. ${assumption.description}${active ? ". Already added" : ""}`}
                  accessibilityRole="button"
                  onPress={() => onSelect(assumption.editor)}
                  style={({ pressed }) => ({
                    minHeight: 68,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.border,
                    borderRadius: radii.md,
                    backgroundColor: active ? colors.accentSoft : colors.surface,
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "800" }}>
                      {assumption.title}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, lineHeight: 18 }}>
                      {assumption.description}
                    </Text>
                  </View>
                  {active ? <Check color={colors.accent} size={20} /> : null}
                  <ChevronRight color={colors.mutedForeground} size={20} />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ paddingVertical: spacing.xl, gap: spacing.xs }}>
                <Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "center" }}>
                  No supported assumptions found
                </Text>
                <Text style={{ color: colors.mutedForeground, textAlign: "center", lineHeight: 20 }}>
                  Try another term. Custom assumptions are not added unless they can be saved.
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
