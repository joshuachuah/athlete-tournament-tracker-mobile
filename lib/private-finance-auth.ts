import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

type PrivateFinanceAuthenticationResult =
  | { success: true }
  | { success: false; message: string | null };

const quietCancellationErrors = new Set([
  "app_cancel",
  "system_cancel",
  "user_cancel",
]);

export async function authenticatePrivateFinances(): Promise<PrivateFinanceAuthenticationResult> {
  const authenticationName = Platform.OS === "ios" ? "Face ID" : "biometrics";

  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) {
      return {
        success: false,
        message: `${authenticationName} is not available on this device.`,
      };
    }

    if (!(await LocalAuthentication.isEnrolledAsync())) {
      return {
        success: false,
        message: `Set up ${authenticationName} in your device settings before opening private finances.`,
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      biometricsSecurityLevel: "strong",
      cancelLabel: "Cancel",
      disableDeviceFallback: true,
      promptDescription: "Your financial values stay hidden until you authenticate.",
      promptMessage: "Unlock private finances",
      promptSubtitle: "Athlete Tracker",
    });

    if (result.success) {
      return { success: true };
    }

    if (quietCancellationErrors.has(result.error)) {
      return { success: false, message: null };
    }

    return {
      success: false,
      message: "Authentication failed. Your private finances stayed locked.",
    };
  } catch {
    return {
      success: false,
      message: "Authentication is unavailable. Your private finances stayed locked.",
    };
  }
}
