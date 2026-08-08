import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

type EmailSignInProps = {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  submitting: boolean;
};

const emailCodePattern = /^\d{6}$/;

export function EmailSignIn({
  disabled,
  onBusyChange,
  submitting,
}: EmailSignInProps) {
  const { requestEmailCode, verifyEmailCode } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const submissionDisabled =
    disabled ||
    submitting ||
    (step === "email" ? !email.trim() : !emailCodePattern.test(emailCode));

  function handleContinue() {
    if (submissionDisabled) {
      return Promise.resolve();
    }

    onBusyChange(true);

    const request =
      step === "email"
        ? requestEmailCode(email).then((sent) => {
            if (sent) {
              setStep("code");
            }
          })
        : verifyEmailCode(email, emailCode).then(() => undefined);

    return request.finally(() => onBusyChange(false));
  }

  function handleResend() {
    if (disabled || submitting) {
      return Promise.resolve();
    }

    onBusyChange(true);
    return requestEmailCode(email)
      .then((sent) => {
        if (sent) {
          setEmailCode("");
        }
      })
      .finally(() => onBusyChange(false));
  }

  return (
    <View style={styles.emailForm}>
      {step === "email" ? (
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!disabled}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            onSubmitEditing={handleContinue}
            placeholder="Email"
            placeholderTextColor="rgba(255, 255, 255, 0.38)"
            returnKeyType="send"
            style={styles.input}
            value={email}
          />
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>Verification code</Text>
          <Text style={styles.emailDescription}>
            Enter the six-digit code sent to {email}.
          </Text>
          <TextInput
            accessibilityLabel="Six-digit email code"
            autoComplete="one-time-code"
            editable={!disabled}
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setEmailCode}
            onSubmitEditing={handleContinue}
            placeholder="000000"
            placeholderTextColor="rgba(255, 255, 255, 0.38)"
            returnKeyType="done"
            style={[styles.input, styles.codeInput]}
            textContentType="oneTimeCode"
            value={emailCode}
          />
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: submitting, disabled: submissionDisabled }}
        disabled={submissionDisabled}
        onPress={handleContinue}
        style={({ pressed }) => [
          styles.emailSubmitButton,
          submissionDisabled && styles.emailSubmitButtonDisabled,
          pressed && !submissionDisabled && styles.emailSubmitButtonPressed,
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#08281B" />
        ) : (
          <Text style={styles.emailSubmitLabel}>
            {step === "email" ? "Continue with email" : "Verify code"}
          </Text>
        )}
      </Pressable>

      {step === "code" ? (
        <View style={styles.secondaryActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: submitting, disabled }}
            disabled={disabled}
            onPress={handleResend}
          >
            <Text style={styles.changeEmail}>Resend code</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => {
              setEmailCode("");
              setStep("email");
            }}
          >
            <Text style={styles.changeEmail}>Change email</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emailForm: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 15,
    fontWeight: "600",
  },
  emailDescription: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: radii.sm,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    color: "#FFFFFF",
    fontSize: 16,
  },
  codeInput: {
    letterSpacing: 8,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
  },
  emailSubmitButton: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: "#D6FFE4",
  },
  emailSubmitButtonDisabled: {
    opacity: 0.42,
  },
  emailSubmitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  emailSubmitLabel: {
    color: "#08281B",
    fontSize: 16,
    fontWeight: "700",
  },
  changeEmail: {
    color: "#D6FFE4",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  secondaryActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
});
