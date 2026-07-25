import { Stack } from "expo-router";
import {
  CircleCheck,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
} from "lucide-react-native";
import { useEffect, useReducer, useRef } from "react";
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ProtectedScreen } from "@/components/auth/protected-screen";
import {
  ProfileForm,
  type ProfileFormValues,
} from "@/components/profile-form";
import { Button } from "@/components/ui/button";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { authenticatePrivateFinances } from "@/lib/private-finance-auth";
import { formatMoney } from "@/lib/utils";

type GateState = "authenticating" | "locked" | "unlocked";
type PrivateFinanceViewState = {
  editing: boolean;
  gateState: GateState;
  message: string | null;
  saveError: string | null;
  saveMessage: string | null;
  saving: boolean;
};

function viewStateReducer(
  state: PrivateFinanceViewState,
  changes: Partial<PrivateFinanceViewState>,
): PrivateFinanceViewState {
  return { ...state, ...changes };
}

async function authenticateSafely() {
  try {
    return await authenticatePrivateFinances();
  } catch {
    return {
      success: false as const,
      message: "Authentication is unavailable. Your private finances stayed locked.",
    };
  }
}

export default function PrivateFinancesScreen() {
  return (
    <ProtectedScreen>
      <PrivateFinancesContent />
    </ProtectedScreen>
  );
}

function PrivateFinancesContent() {
  const { profile, saveProfile } = useAuth();
  const [viewState, updateViewState] = useReducer(viewStateReducer, {
    editing: false,
    gateState: "authenticating",
    message: null,
    saveError: null,
    saveMessage: null,
    saving: false,
  });
  const { editing, gateState, message, saveError, saveMessage, saving } =
    viewState;
  const authenticationAttempt = useRef(0);
  const isForeground = useRef(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );

  useEffect(() => {
    let active = true;
    const attempt = ++authenticationAttempt.current;

    authenticateSafely().then((result) => {
      if (
        !active ||
        attempt !== authenticationAttempt.current ||
        !isForeground.current
      ) {
        return;
      }

      if (result.success) {
        updateViewState({ gateState: "unlocked", message: null });
      } else {
        updateViewState({ gateState: "locked", message: result.message });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      isForeground.current = nextState === "active";
      if (nextState !== "active") {
        authenticationAttempt.current += 1;
        updateViewState({
          editing: false,
          gateState: "locked",
          message:
            "Private finances locked when Athlete Tracker left the foreground.",
          saveError: null,
          saveMessage: null,
          saving: false,
        });
      }
    });

    return () => subscription.remove();
  }, []);

  async function handleUnlock() {
    const attempt = ++authenticationAttempt.current;
    updateViewState({ gateState: "authenticating", message: null });
    const result = await authenticateSafely();

    if (attempt !== authenticationAttempt.current || !isForeground.current) {
      return;
    }

    if (result.success) {
      updateViewState({ gateState: "unlocked" });
      return;
    }

    updateViewState({ gateState: "locked", message: result.message });
  }

  async function handleFinancialSave(values: ProfileFormValues) {
    updateViewState({
      saveError: null,
      saveMessage: null,
      saving: true,
    });

    try {
      await saveProfile(values);
      updateViewState({
        editing: false,
        saveMessage: "Private finances updated.",
        saving: false,
      });
    } catch (profileError) {
      updateViewState({
        saveError: (profileError as Error).message,
        saving: false,
      });
    }
  }

  if (!profile) {
    return null;
  }

  const authenticationName = Platform.OS === "ios" ? "Face ID" : "biometrics";

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Account",
          title: "Private finances",
        }}
      />
      {gateState === "unlocked" ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
        >
          <View style={styles.verifiedBadge}>
            <CircleCheck color={colors.accent} size={16} strokeWidth={2.4} />
            <Text style={styles.verifiedText}>{authenticationName} verified</Text>
          </View>

          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {editing ? "Edit private finances" : "Private finances"}
            </Text>
            <Text style={styles.subtitle}>
              {editing
                ? "Update the financial assumptions used to calculate runway and tournament affordability."
                : "Visible only for this authenticated view. Leaving the app locks these values again."}
            </Text>
          </View>

          {saveError ? (
            <Text accessibilityRole="alert" selectable style={styles.error}>
              {saveError}
            </Text>
          ) : null}
          {saveMessage ? (
            <Text accessibilityLiveRegion="polite" selectable style={styles.success}>
              {saveMessage}
            </Text>
          ) : null}

          {editing ? (
            <>
              <ProfileForm
                fields="finances"
                loading={saving}
                profile={profile}
                submitLabel="Save private finances"
                onSubmit={handleFinancialSave}
              />
              <Button
                disabled={saving}
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  updateViewState({ editing: false, saveError: null });
                }}
              />
            </>
          ) : (
            <View
              accessibilityLabel="Private financial details"
              style={styles.values}
            >
              <FinanceValue
                label="Monthly income"
                value={formatMoney(profile.monthly_income, profile.home_currency)}
              />
              <View style={styles.separator} />
              <FinanceValue
                label="Savings balance"
                value={formatMoney(profile.savings_balance, profile.home_currency)}
              />
              <View style={styles.separator} />
              <FinanceValue
                label="Monthly sponsorship"
                value={formatMoney(
                  profile.monthly_sponsorship,
                  profile.home_currency,
                )}
              />
            </View>
          )}

          {!editing ? (
            <Button
              label="Edit private finances"
              variant="secondary"
              onPress={() => {
                updateViewState({
                  editing: true,
                  saveError: null,
                  saveMessage: null,
                });
              }}
            />
          ) : null}

          <View style={styles.sessionNote}>
            <ShieldCheck color={colors.mutedForeground} size={17} strokeWidth={2.2} />
            <Text style={styles.sessionNoteText}>
              Authentication is required again after this screen closes or the app
              moves to the background.
            </Text>
          </View>

          <Button
            label="Lock private finances"
            variant="secondary"
            onPress={() => {
              updateViewState({
                editing: false,
                gateState: "locked",
                message: "Private finances locked.",
                saveError: null,
                saveMessage: null,
              });
            }}
          />
        </ScrollView>
      ) : (
        <View style={styles.gate}>
          <View style={styles.gateIcon}>
            {gateState === "authenticating" ? (
              <ScanFace color={colors.accent} size={34} strokeWidth={1.8} />
            ) : (
              <LockKeyhole color={colors.accent} size={31} strokeWidth={2} />
            )}
          </View>
          <Text style={styles.gateTitle}>
            {gateState === "authenticating"
              ? "Authenticating…"
              : "Private finances locked"}
          </Text>
          <Text style={styles.gateBody}>
            {message ??
              `Use ${authenticationName} to view your income, savings, and sponsorship details.`}
          </Text>
          {gateState === "locked" ? (
            <Button label={`Unlock with ${authenticationName}`} onPress={handleUnlock} />
          ) : null}
        </View>
      )}
    </>
  );
}

function FinanceValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.valueRow}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  verifiedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  verifiedText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  heading: {
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.loss,
    fontSize: 14,
    lineHeight: 20,
  },
  success: {
    color: colors.profit,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  values: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow:
      "0 2px 4px rgba(14, 16, 18, 0.04), 0 18px 34px -18px rgba(14, 16, 18, 0.18)",
  },
  valueRow: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  valueLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  value: {
    color: colors.foreground,
    fontSize: 27,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.border,
  },
  sessionNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sessionNoteText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  gate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  gateIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
  },
  gateTitle: {
    color: colors.foreground,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  gateBody: {
    maxWidth: 330,
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
