import * as Crypto from "expo-crypto";

import { createAppleAuthRequest } from "@/lib/apple-auth";
import { LEGACY_AUTH_CALLBACK, oauthRedirectUri } from "@/lib/auth-redirect";

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(),
  getRandomBytesAsync: jest.fn(),
}));

describe("OAuth callback selection", () => {
  it("uses the registered custom app scheme in every native build", () => {
    expect(oauthRedirectUri()).toBe(LEGACY_AUTH_CALLBACK);
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
