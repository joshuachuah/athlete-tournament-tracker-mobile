import * as Crypto from "expo-crypto";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export type AppleAuthRequest = {
  rawNonce: string;
  hashedNonce: string;
  state: string;
};

export async function createAppleAuthRequest(): Promise<AppleAuthRequest> {
  const [nonceBytes, stateBytes] = await Promise.all([
    Crypto.getRandomBytesAsync(32),
    Crypto.getRandomBytesAsync(16),
  ]);
  const rawNonce = bytesToHex(nonceBytes);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  return {
    rawNonce,
    hashedNonce,
    state: bytesToHex(stateBytes),
  };
}
