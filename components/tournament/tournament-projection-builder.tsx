import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssumptionPicker } from "@/components/tournament/assumption-picker";
import {
  ImpactLedger,
  type ProjectionEditor,
} from "@/components/tournament/impact-ledger";
import { ProjectionEditorSheet } from "@/components/tournament/projection-editor-sheet";
import { ScenarioStrip } from "@/components/tournament/scenario-strip";
import { TournamentIdentitySearch } from "@/components/tournament/tournament-identity-search";
import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/constants/theme";
import { useTournamentDraft } from "@/context/tournament-draft";
import {
  detailsSchema,
  prizesSchema,
  spendingSchema,
  subsidySchema,
  travelSchema,
  type TournamentDraft,
} from "@/lib/tournament-draft";

const IOS_NATIVE_TAB_BAR_CLEARANCE = spacing.xxl * 2;

function firstInvalidEditor(draft: TournamentDraft): ProjectionEditor | null {
  if (!detailsSchema.safeParse(draft).success) return "details";
  if (!prizesSchema.safeParse(draft).success) return "prize";
  if (!travelSchema.safeParse(draft).success) return "travel";
  if (!Object.values(draft.prize_rounds).some((amount) => amount > 0)) return "prize";
  if (!subsidySchema.safeParse(draft).success) return "subsidy";

  const spending = spendingSchema.safeParse(draft);
  if (!spending.success) {
    const path = spending.error.issues[0]?.path[0];
    if (path === "coaching_cost") return "coaching";
    if (path === "misc_cost") return "misc";
    return "daily-spending";
  }

  return null;
}

function actionLabel(draft: TournamentDraft, identityResolved: boolean) {
  if (draft.editId) return "Save changes";
  if (!identityResolved || !draft.name.trim()) return "Choose tournament";

  const invalid = firstInvalidEditor(draft);
  if (invalid === "details") return "Complete tournament details";
  if (invalid === "prize") {
    return Object.values(draft.prize_rounds).some((amount) => amount > 0)
      ? "Review prize and tax"
      : "Add prize estimate";
  }
  if (invalid === "travel") return "Review travel and stay";
  if (invalid) return "Review optional assumptions";
  return "Create projection";
}

export function TournamentProjectionBuilder({
  authenticatedUserId,
  homeCurrency,
  initialDraft,
  loading = false,
  onSubmit,
  profileId,
  sport,
  submitError,
}: {
  authenticatedUserId: string;
  homeCurrency: string;
  initialDraft: TournamentDraft;
  loading?: boolean;
  onSubmit: (draft: TournamentDraft) => void;
  profileId: string;
  sport?: string;
  submitError?: string | null;
}) {
  const { setDraft } = useTournamentDraft();
  const [formDraft, setFormDraft] = useState(() => initialDraft);
  const [activeEditor, setActiveEditor] = useState<ProjectionEditor | null>(null);
  const [assumptionPickerOpen, setAssumptionPickerOpen] = useState(false);
  const [submissionSummary, setSubmissionSummary] = useState<string | null>(null);
  const [identityResolved, setIdentityResolved] = useState(Boolean(initialDraft.name.trim()));
  const [identityResetVersion, setIdentityResetVersion] = useState(0);
  const [stage, setStage] = useState<"identity" | "projection">(() =>
    initialDraft.name.trim() ? "projection" : "identity",
  );
  const identityInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const actionAreaBottomPadding =
    Platform.OS === "ios"
      ? insets.bottom + IOS_NATIVE_TAB_BAR_CLEARANCE
      : Math.max(insets.bottom, spacing.md);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft.editId]);

  function updateDraft(next: TournamentDraft) {
    setFormDraft(next);
    setDraft(next);
    setSubmissionSummary(null);
  }

  function handlePrimaryAction() {
    if (!identityResolved || !formDraft.name.trim()) {
      setSubmissionSummary("Choose a known tournament or enter a new tournament name.");
      identityInputRef.current?.focus();
      return;
    }

    if (stage === "identity") {
      Keyboard.dismiss();
      setSubmissionSummary(null);
      setStage("projection");
      return;
    }

    const invalidEditor = firstInvalidEditor(formDraft);
    if (invalidEditor) {
      setSubmissionSummary("Complete the highlighted section before saving.");
      setActiveEditor(invalidEditor);
      return;
    }

    Keyboard.dismiss();
    setSubmissionSummary(null);
    onSubmit(formDraft);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        testID="projection-builder-scroll"
        accessibilityElementsHidden={loading}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        importantForAccessibility={loading ? "no-hide-descendants" : "auto"}
        pointerEvents={loading ? "none" : "auto"}
        contentContainerStyle={{
          gap: stage === "identity" ? spacing.xl : spacing.xxl,
          padding: spacing.xl,
          paddingBottom: actionAreaBottomPadding,
        }}
      >
        {stage === "identity" ? (
          <TournamentIdentitySearch
            key={`identity:${formDraft.name}:${identityResetVersion}`}
            draft={formDraft}
            inputRef={identityInputRef}
            onChangeDraft={updateDraft}
            onResolutionChange={setIdentityResolved}
            sport={sport}
          />
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <View style={{ gap: spacing.xs }}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  Tournament projection
                </Text>
                <Text
                  style={{ color: colors.foreground, fontSize: 26, fontWeight: "900" }}
                >
                  {formDraft.name}
                </Text>
                <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
                  {formDraft.location.trim() || "Add the details needed to calculate outcomes."}
                </Text>
              </View>
              {!formDraft.editId ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSubmissionSummary(null);
                    setStage("identity");
                  }}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    alignSelf: "flex-start",
                    justifyContent: "center",
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: colors.accent, fontWeight: "800" }}>
                    Change tournament
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <ScenarioStrip
              authenticatedUserId={authenticatedUserId}
              draft={formDraft}
              homeCurrency={homeCurrency}
              identityResolved={identityResolved}
              profileId={profileId}
            />

            <ImpactLedger
              draft={formDraft}
              onAddAssumption={() => setAssumptionPickerOpen(true)}
              onOpenEditor={setActiveEditor}
            />
          </>
        )}

        <View testID="projection-action-area" style={{ gap: spacing.sm }}>
          {submissionSummary ? (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.loss, lineHeight: 19 }}>
              {submissionSummary}
            </Text>
          ) : null}
          {submitError ? (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.loss, lineHeight: 19 }}>
              {submitError}
            </Text>
          ) : null}
          <Button
            testID="projection-primary-action"
            label={
              stage === "identity"
                ? identityResolved && formDraft.name.trim()
                  ? "Continue"
                  : "Choose tournament"
                : actionLabel(formDraft, identityResolved)
            }
            loading={loading}
            onPress={handlePrimaryAction}
          />
          {loading ? (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.mutedForeground, textAlign: "center" }}>
              Saving projection. Editing is temporarily disabled.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {activeEditor ? (
        <ProjectionEditorSheet
          draft={formDraft}
          editor={activeEditor}
          onApply={(nextDraft) => {
            updateDraft(nextDraft);
            if (activeEditor === "details") {
              setIdentityResolved(Boolean(nextDraft.name.trim()));
              setIdentityResetVersion((current) => current + 1);
            }
            setActiveEditor(null);
          }}
          onClose={() => setActiveEditor(null)}
        />
      ) : null}

      {assumptionPickerOpen ? (
        <AssumptionPicker
          draft={formDraft}
          onClose={() => setAssumptionPickerOpen(false)}
          onSelect={(editor) => {
            setAssumptionPickerOpen(false);
            setActiveEditor(editor);
          }}
        />
      ) : null}
    </View>
  );
}
