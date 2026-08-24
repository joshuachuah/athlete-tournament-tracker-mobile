import * as Crypto from "expo-crypto";

import { createAppleAuthRequest } from "@/lib/apple-auth";
import {
  CUSTOM_SCHEME_AUTH_CALLBACK,
  isExpectedAuthCallback,
  oauthRedirectUri,
} from "@/lib/auth-redirect";

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(),
  getRandomBytesAsync: jest.fn(),
}));

describe("OAuth callback validation", () => {
  it("uses the registered custom scheme for native OAuth", () => {
    expect(oauthRedirectUri()).toBe(CUSTOM_SCHEME_AUTH_CALLBACK);
  });

  it("accepts the configured callback with query parameters", () => {
    expect(
      isExpectedAuthCallback(
        new URL("athletetracker://auth/callback?code=one-time-code"),
        CUSTOM_SCHEME_AUTH_CALLBACK,
      ),
    ).toBe(true);
  });

  it.each([
    ["scheme", "othertracker://auth/callback?code=one-time-code"],
    ["host", "athletetracker://other/callback?code=one-time-code"],
    ["path", "athletetracker://auth/other?code=one-time-code"],
    ["userinfo", "athletetracker://evil@auth/callback?code=one-time-code"],
  ])("rejects a callback with an unexpected %s: %s", (_part, url) => {
    expect(
      isExpectedAuthCallback(new URL(url), CUSTOM_SCHEME_AUTH_CALLBACK),
    ).toBe(false);
  });
});

describe("Apple authentication request security", () => {
  it("generates independent nonce/state values and hashes only the nonce", async () => {
    const nonceBytes = Uint8Array.from({ length: 32 }, (_, index) => index);
    const stateBytes = Uint8Array.from({ length: 16 }, (_, index) => 255 - index);
    const getRandomBytes =
      Crypto.getRandomBytesAsync as jest.MockedFunction<
        typeof Crypto.getRandomBytesAsync
      >;
    getRandomBytes
      .mockResolvedValueOnce(nonceBytes)
      .mockResolvedValueOnce(stateBytes);
    const digest =
      Crypto.digestStringAsync as jest.MockedFunction<
        typeof Crypto.digestStringAsync
      >;
    digest.mockResolvedValue("hashed-nonce");

    const request = await createAppleAuthRequest();

    expect(getRandomBytes).toHaveBeenNthCalledWith(1, 32);
    expect(getRandomBytes).toHaveBeenNthCalledWith(2, 16);
    expect(request.rawNonce).toHaveLength(64);
    expect(request.state).toHaveLength(32);
    expect(request.rawNonce).not.toBe(request.state);
    expect(digest).toHaveBeenCalledWith("SHA-256", request.rawNonce);
    expect(request.hashedNonce).toBe("hashed-nonce");
  });
});
