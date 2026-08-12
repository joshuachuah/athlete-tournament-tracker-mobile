import * as Crypto from "expo-crypto";

import { createAppleAuthRequest } from "@/lib/apple-auth";
import {
  CUSTOM_SCHEME_AUTH_CALLBACK,
  HTTPS_AUTH_CALLBACK,
  isExpectedAuthCallback,
  oauthRedirectUri,
  supportsHttpsAuthCallback,
} from "@/lib/auth-redirect";

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(),
  getRandomBytesAsync: jest.fn(),
}));

describe("OAuth callback validation", () => {
  it.each([
    ["ios", "17.3", false],
    ["ios", "17.4", true],
    ["ios", "18.0", true],
    ["android", "18", false],
  ])("selects HTTPS support for %s %s", (os, version, supported) => {
    expect(supportsHttpsAuthCallback(os, version)).toBe(supported);
    expect(oauthRedirectUri(os, version, false)).toBe(
      supported ? HTTPS_AUTH_CALLBACK : CUSTOM_SCHEME_AUTH_CALLBACK,
    );
  });

  it("uses the registered custom scheme in development", () => {
    expect(oauthRedirectUri("ios", "18.0", true)).toBe(
      "athletetracker://auth/callback",
    );
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

  it("accepts only the configured HTTPS callback host and path", () => {
    expect(
      isExpectedAuthCallback(
        new URL(`${HTTPS_AUTH_CALLBACK}?code=one-time-code`),
        HTTPS_AUTH_CALLBACK,
      ),
    ).toBe(true);
    expect(
      isExpectedAuthCallback(
        new URL("https://web-production-2fa073.up.railway.app/other?code=x"),
        HTTPS_AUTH_CALLBACK,
      ),
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
