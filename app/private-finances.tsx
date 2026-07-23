import { Stack } from "expo-router";
import {
  CircleCheck,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ProtectedScreen } from "@/components/auth/protected-screen";
import { Button } from "@/components/ui/button";
import { colors, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { authenticatePrivateFinances } from "@/lib/private-finance-auth";
import { formatMoney } from "@/lib/utils";

type GateState = "authenticating" | "locked" | "unlocked";

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
  const { profile } = useAuth();
  const [gateState, setGateState] = useState<GateState>("authenticating");
  const [message, setMessage] = useState<string | null>(null);
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
        setGateState("unlocked");
        setMessage(null);
      } else {
        setGateState("locked");
        setMessage(result.message);
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
        setGateState("locked");
        setMessage(
          "Private finances locked when Athlete Tracker left the foreground.",
        );
      }
    });

    return () => subscription.remove();
  }, []);

  async function handleUnlock() {
    const attempt = ++authenticationAttempt.current;
    setGateState("authenticating");
    setMessage(null);
    const result = await authenticateSafely();

    if (attempt !== authenticationAttempt.current || !isForeground.current) {
      return;
    }

    if (result.success) {
      setGateState("unlocked");
      return;
    }

    setGateState("locked");
    setMessage(result.message);
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
            <Text style={styles.title}>Private finances</Text>
            <Text style={styles.subtitle}>
              Visible only for this authenticated view. Leaving the app locks these
              values again.
            </Text>
          </View>

          <View accessibilityLabel="Private financial details" style={styles.values}>
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
              value={formatMoney(profile.monthly_sponsorship, profile.home_currency)}
            />
          </View>

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
              setGateState("locked");
              setMessage("Private finances locked.");
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
