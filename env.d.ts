declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    EXPO_PUBLIC_PRIVACY_POLICY_URL?: string;
    EXPO_PUBLIC_ACCOUNT_DELETION_URL?: string;
  }
}
