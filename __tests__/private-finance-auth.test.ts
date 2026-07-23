import * as LocalAuthentication from "expo-local-authentication";

import { authenticatePrivateFinances } from "@/lib/private-finance-auth";

jest.mock("expo-local-authentication", () => ({
  authenticateAsync: jest.fn(),
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
}));

const mockAuthenticate =
  LocalAuthentication.authenticateAsync as jest.MockedFunction<
    typeof LocalAuthentication.authenticateAsync
  >;
const mockHasHardware =
  LocalAuthentication.hasHardwareAsync as jest.MockedFunction<
    typeof LocalAuthentication.hasHardwareAsync
  >;
const mockIsEnrolled =
  LocalAuthentication.isEnrolledAsync as jest.MockedFunction<
    typeof LocalAuthentication.isEnrolledAsync
  >;

describe("private finance authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
  });

  it("requires enrolled biometric hardware before prompting", async () => {
    mockHasHardware.mockResolvedValue(false);

    await expect(authenticatePrivateFinances()).resolves.toEqual({
      success: false,
      message: expect.stringContaining("not available"),
    });
    expect(mockIsEnrolled).not.toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it("unlocks only after a successful strong biometric prompt", async () => {
    mockAuthenticate.mockResolvedValue({ success: true });

    await expect(authenticatePrivateFinances()).resolves.toEqual({ success: true });
    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        biometricsSecurityLevel: "strong",
        disableDeviceFallback: true,
        promptMessage: "Unlock private finances",
      }),
    );
  });

  it("keeps a user cancellation quiet and locked", async () => {
    mockAuthenticate.mockResolvedValue({
      success: false,
      error: "user_cancel",
    });

    await expect(authenticatePrivateFinances()).resolves.toEqual({
      success: false,
      message: null,
    });
  });

  it("returns a safe failure message for rejected authentication", async () => {
    mockAuthenticate.mockResolvedValue({
      success: false,
      error: "authentication_failed",
    });

    await expect(authenticatePrivateFinances()).resolves.toEqual({
      success: false,
      message: "Authentication failed. Your private finances stayed locked.",
    });
  });

  it("fails closed when native authentication throws", async () => {
    mockAuthenticate.mockRejectedValue(new Error("native authentication unavailable"));

    await expect(authenticatePrivateFinances()).resolves.toEqual({
      success: false,
      message: "Authentication is unavailable. Your private finances stayed locked.",
    });
  });
});
