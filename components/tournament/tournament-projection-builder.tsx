import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  Alert,
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
import { prizeDistributionCurrency } from "@/lib/prize-distributions";
import {
  detailsSchema,
  prizesSchema,
  spendingSchema,
  subsidySchema,
  travelSchema,
  type TournamentDraft,
} from "@/lib/tournament-draft";

const IOS_NATIVE_TAB_BAR_CLEARANCE = spacing.xxl * 2;

type BuilderState = {
  activeEditor: ProjectionEditor | null;
  assumptionPickerOpen: boolean;
  formDraft: TournamentDraft;
  identityResetVersion: number;
  identityResolved: boolean;
  stage: "identity" | "projection";
  submissionSummary: string | null;
};

function createBuilderState(initialDraft: TournamentDraft): BuilderState {
  return {
    activeEditor: null,
    assumptionPickerOpen: false,
    formDraft: initialDraft,
    identityResetVersion: 0,
    identityResolved: Boolean(initialDraft.name.trim()),
    stage: initialDraft.name.trim() ? "projection" : "identity",
    submissionSummary: null,
  };
}

function builderReducer(
  state: BuilderState,
  changes: Partial<BuilderState>,
): BuilderState {
  return { ...state, ...changes };
}

function firstInvalidEditor(draft: TournamentDraft): ProjectionEditor | null {
  if (!detailsSchema.safeParse(draft).success) return "details";
  if (!prizesSchema.safeParse(draft).success) return "prize";
  if (!travelSchema.safeParse(draft).success) return "travel";
  const hasPrizeRounds = Object.values(draft.prize_rounds).some(
    (amount) => amount > 0,
  );
  // PSA only supplies USD schedules. Other currencies remain valid with no
  // prize outcomes instead of making the client invent an FX conversion.
  if (
    !hasPrizeRounds &&
    draft.currency.toUpperCase() === prizeDistributionCurrency
  ) {
    return "prize";
  }
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
      ? "Review prize money"
      : "Add prize money";
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
  saveCompleted = false,
  sport,
  submitError,
}: {
  authenticatedUserId: string;
  homeCurrency: string;
  initialDraft: TournamentDraft;
  loading?: boolean;
  onSubmit: (draft: TournamentDraft) => void;
  profileId: string;
  saveCompleted?: boolean;
  sport?: string;
  submitError?: string | null;
}) {
  const { setDraft } = useTournamentDraft();
  const [builderState, updateBuilderState] = useReducer(
    builderReducer,
    initialDraft,
    createBuilderState,
  );
  const {
    activeEditor,
    assumptionPickerOpen,
    formDraft,
    identityResetVersion,
    identityResolved,
    stage,
    submissionSummary,
  } = builderState;
  const identityInputRef = useRef<TextInput>(null);
  const [initialDraftBaseline] = useState(initialDraft);
  const setPersistedDraftRef = useRef(setDraft);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const hasUnsavedEdit =
    Boolean(formDraft.editId) &&
    JSON.stringify(formDraft) !== JSON.stringify(initialDraftBaseline);

  usePreventRemove(hasUnsavedEdit && !saveCompleted, ({ data }) => {
    if (loading) {
      Alert.alert(
        "Saving changes",
        "Wait for the tournament update to finish before leaving.",
      );
      return;
    }

    Alert.alert(
      "Discard unsaved changes?",
      "Your tournament changes have not been saved.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
  const actionAreaBottomPadding =
    Platform.OS === "ios"
      ? insets.bottom + IOS_NATIVE_TAB_BAR_CLEARANCE
      : Math.max(insets.bottom, spacing.md);

  useEffect(() => {
    // The container keys the builder by create/edit identity. Seed persistence
    // once per mount without re-syncing over the user's in-progress edits.
    setPersistedDraftRef.current(initialDraftBaseline);
  }, [initialDraftBaseline]);

  function updateDraft(next: TournamentDraft) {
    updateBuilderState({ formDraft: next, submissionSummary: null });
    setDraft(next);
  }

  function handlePrimaryAction() {
    if (!identityResolved || !formDraft.name.trim()) {
      updateBuilderState({
        submissionSummary:
          "Choose a known tournament or enter a new tournament name.",
      });
      identityInputRef.current?.focus();
      return;
    }

    if (stage === "identity") {
      Keyboard.dismiss();
      updateBuilderState({ stage: "projection", submissionSummary: null });
      return;
    }

    const invalidEditor = firstInvalidEditor(formDraft);
    if (invalidEditor) {
      updateBuilderState({
        activeEditor: invalidEditor,
        submissionSummary: "Complete the highlighted section before saving.",
      });
      return;
    }

    Keyboard.dismiss();
    updateBuilderState({ submissionSummary: null });
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
        contentInset={{ bottom: actionAreaBottomPadding }}
        scrollIndicatorInsets={{ bottom: actionAreaBottomPadding }}
        contentContainerStyle={{
          gap: stage === "identity" ? spacing.xl : spacing.xxl,
          padding: spacing.xl,
          paddingBottom: 0,
        }}
      >
        {stage === "identity" ? (
          <TournamentIdentitySearch
            key={`identity:${formDraft.name}:${identityResetVersion}`}
            draft={formDraft}
            inputRef={identityInputRef}
            onChangeDraft={updateDraft}
            onResolutionChange={(identityResolved) =>
              updateBuilderState({ identityResolved })
            }
            sport={sport}
          />
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <View style={{ gap: spacing.xs }}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 13,
                    fontWeight: "700",
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
                    updateBuilderState({
                      stage: "identity",
                      submissionSummary: null,
                    });
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
              onAddAssumption={() =>
                updateBuilderState({ assumptionPickerOpen: true })
              }
              onOpenEditor={(activeEditor) =>
                updateBuilderState({ activeEditor })
              }
            />
          </>
        )}

        <View
          testID="projection-action-area"
          style={{
            gap: spacing.sm,
            paddingBottom:
              Platform.OS === "android" ? actionAreaBottomPadding : 0,
          }}
        >
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
              updateBuilderState({
                activeEditor: null,
                identityResolved: Boolean(nextDraft.name.trim()),
                identityResetVersion: identityResetVersion + 1,
              });
              return;
            }
            updateBuilderState({ activeEditor: null });
          }}
          onClose={() => updateBuilderState({ activeEditor: null })}
        />
      ) : null}

      {assumptionPickerOpen ? (
        <AssumptionPicker
          draft={formDraft}
          onClose={() =>
            updateBuilderState({ assumptionPickerOpen: false })
          }
          onSelect={(editor) => {
            updateBuilderState({
              activeEditor: editor,
              assumptionPickerOpen: false,
            });
          }}
        />
      ) : null}
    </View>
  );
}
