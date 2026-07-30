const apiBase =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:5000";

export const privacyPolicyUrl =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? `${apiBase}/privacy`;

export const accountDeletionInfoUrl =
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL ?? `${apiBase}/account-deletion`;
