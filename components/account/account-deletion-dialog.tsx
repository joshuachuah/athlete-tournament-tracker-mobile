import { AlertTriangle, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/api";

type AccountDeletionDialogProps = {
  onClose: () => void;
  onDelete: () => Promise<void>;
};

export function AccountDeletionDialog({
  onClose,
  onDelete,
}: AccountDeletionDialogProps) {
  const [step, setStep] = useState<"details" | "confirm">("details");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function close() {
    if (!deleting) {
      onClose();
    }
  }

  async function deleteAccount() {
    if (confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await onDelete();
      onClose();
    } catch (deleteError) {
      setError((deleteError as Error).message);
      setDeleting(false);
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      transparent
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View
          accessibilityViewIsModal
          style={styles.dialog}
          testID="account-deletion-dialog"
        >
          <View style={styles.warningIcon}>
            <AlertTriangle color={colors.loss} size={24} strokeWidth={2.2} />
          </View>

          {step === "details" ? (
            <>
              <View style={styles.dialogCopy}>
                <Text accessibilityRole="header" style={styles.dialogTitle}>
                  Delete your account?
                </Text>
                <Text style={styles.dialogBody}>
                  This permanently deletes the data connected to your account:
                </Text>
              </View>

              <View style={styles.deletionList}>
                <Text style={styles.deletionItem}>
                  • Your athlete profile and private financial values
                </Text>
                <Text style={styles.deletionItem}>
                  • Every saved tournament and projection
                </Text>
                <Text style={styles.deletionItem}>
                  • Your sign-in access to this account
                </Text>
              </View>

              <Text style={styles.irreversibleNote}>This cannot be undone.</Text>

              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep("confirm")}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={close}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.dialogCopy}>
                <Text accessibilityRole="header" style={styles.dialogTitle}>
                  Confirm permanent deletion
                </Text>
                <Text style={styles.dialogBody}>
                  Type {ACCOUNT_DELETION_CONFIRMATION} to confirm that you want to
                  permanently delete this account.
                </Text>
              </View>

              <TextInput
                accessibilityLabel="Type DELETE to confirm account deletion"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!deleting}
                onChangeText={setConfirmation}
                placeholder={ACCOUNT_DELETION_CONFIRMATION}
                placeholderTextColor={colors.mutedForeground}
                style={styles.confirmationInput}
                value={confirmation}
              />

              {error ? (
                <Text accessibilityRole="alert" selectable style={styles.error}>
                  {error}
                </Text>
              ) : null}

              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    deleting || confirmation !== ACCOUNT_DELETION_CONFIRMATION
                  }
                  onPress={deleteAccount}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    (deleting ||
                      confirmation !== ACCOUNT_DELETION_CONFIRMATION) &&
                      styles.buttonDisabled,
                    pressed && !deleting && styles.deleteButtonPressed,
                  ]}
                >
                  {deleting ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Trash2 color={colors.surface} size={18} strokeWidth={2.2} />
                  )}
                  <Text style={styles.deleteButtonText}>
                    {deleting ? "Deleting…" : "Delete permanently"}
                  </Text>
                </Pressable>
                <View style={styles.secondaryActionRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={deleting}
                    onPress={() => {
                      setError(null);
                      setConfirmation("");
                      setStep("details");
                    }}
                    style={({ pressed }) => [
                      styles.inlineButton,
                      pressed && styles.secondaryButtonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={deleting}
                    onPress={close}
                    style={({ pressed }) => [
                      styles.inlineButton,
                      pressed && styles.secondaryButtonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: "rgba(14, 16, 18, 0.48)",
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  warningIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.lossSoft,
  },
  dialogCopy: {
    gap: spacing.sm,
  },
  dialogTitle: {
    color: colors.foreground,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.35,
  },
  dialogBody: {
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 22,
  },
  deletionList: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  deletionItem: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  irreversibleNote: {
    color: colors.loss,
    fontSize: 14,
    fontWeight: "700",
  },
  confirmationInput: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: colors.loss,
    fontSize: 14,
    lineHeight: 20,
  },
  dialogActions: {
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.foreground,
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  deleteButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.loss,
  },
  deleteButtonPressed: {
    opacity: 0.86,
  },
  deleteButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  secondaryActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  inlineButton: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
});
