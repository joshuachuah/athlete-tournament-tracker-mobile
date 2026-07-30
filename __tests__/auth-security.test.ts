import * as Crypto from "expo-crypto";

import { createAppleAuthRequest } from "@/lib/apple-auth";
import {
  HTTPS_AUTH_CALLBACK,
  LEGACY_AUTH_CALLBACK,
  oauthRedirectUri,
  supportsHttpsAuthCallback,
} from "@/lib/auth-redirect";

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(),
  getRandomBytesAsync: jest.fn(),
}));

describe("OAuth callback selection", () => {
  it.each([
    ["ios", "17.3", false],
    ["ios", "17.4", true],
    ["ios", "18.0", true],
    ["android", "18", false],
  ])("selects the supported callback for %s %s", (os, version, supported) => {
    expect(supportsHttpsAuthCallback(os, version)).toBe(supported);
    expect(oauthRedirectUri(os, version)).toBe(
      supported ? HTTPS_AUTH_CALLBACK : LEGACY_AUTH_CALLBACK,
    );
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
