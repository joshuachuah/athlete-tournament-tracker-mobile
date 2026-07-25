import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  clearLegacyTournamentDraft,
  draftStorage,
  profileStorage,
  tournamentDraftStorageKey,
} from "@/lib/storage";
import type { AthleteProfile } from "@/types";

WebBrowser.maybeCompleteAuthSession();

type ProfileInput = Partial<AthleteProfile> & {
  name: string;
  home_country: string;
  home_currency: string;
  sport: string;
};

type AuthContextValue = {
  session: Session | null;
  profile: AthleteProfile | null;
  status: "loading" | "ready";
  authError: string | null;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (data: ProfileInput) => Promise<AthleteProfile>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  isCurrentUser: (userId: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function cacheProfile(userId: string, profile: AthleteProfile | null): void {
  if (profile) {
    profileStorage.set(userId, profile);
  } else {
    profileStorage.clear();
  }
}

function redirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: "athletetracker",
    path: "auth/callback",
  });
}

async function startGoogleSignIn(
  setAuthError: (error: string | null) => void,
) {
  if (!supabase) {
    setAuthError(
      "Supabase is not configured. Set Expo public Supabase environment variables.",
    );
    return;
  }

  setAuthError(null);
  const callbackUrl = redirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    setAuthError(error.message);
    return;
  }

  if (!data.url) {
    setAuthError("Supabase did not return an OAuth URL.");
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, callbackUrl);

  if (result.type !== "success") {
    return;
  }

  if (result.url.includes("#")) {
    setAuthError("OAuth callback did not include a valid session code.");
    return;
  }

  let callback: URL;

  try {
    callback = new URL(result.url);
  } catch {
    setAuthError("OAuth callback URL was invalid.");
    return;
  }

  if (callback.searchParams.has("error")) {
    setAuthError("OAuth sign-in was rejected by the provider.");
    return;
  }

  const code = callback.searchParams.get("code");

  if (code) {
    const exchange = await supabase.auth.exchangeCodeForSession(code);
    if (exchange.error) {
      setAuthError(exchange.error.message);
    }
    return;
  }

  setAuthError("OAuth callback did not include a session code.");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Sign in failed.";
}

function isAppleCancellation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_REQUEST_CANCELED"
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [authError, setAuthError] = useState<string | null>(
    hasSupabaseConfig
      ? null
      : "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
  const identityVersion = useRef(0);
  const profileLoadVersion = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const currentEmail = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    let active = true;
    mounted.current = true;

    function beginProfileLoad(event: string | null, nextSession: Session | null) {
      const userId = nextSession?.user.id ?? null;
      const email = nextSession?.user.email ?? null;
      const identityChanged = currentUserId.current !== userId;
      const loadVersion = ++profileLoadVersion.current;

      if (identityChanged) {
        ++identityVersion.current;
      }

      if (identityChanged || event === "SIGNED_OUT") {
        queryClient.clear();
      }

      if (event === "SIGNED_OUT") {
        profileStorage.clear();
      }

      currentUserId.current = userId;
      currentEmail.current = email;
      setSession(nextSession);

      if (!userId || !email) {
        setProfile(null);
        profileStorage.clear();
        setStatus("ready");
        return;
      }

      const cachedProfile = profileStorage.getForUser(userId);
      setProfile(cachedProfile);
      setStatus(cachedProfile ? "ready" : "loading");

      api.profile
        .get(email)
        .then((freshProfile) => {
          if (
            !active ||
            !mounted.current ||
            profileLoadVersion.current !== loadVersion ||
            currentUserId.current !== userId ||
            currentEmail.current !== email
          ) {
            return;
          }

          cacheProfile(userId, freshProfile);
          setProfile(freshProfile);
          setStatus("ready");
        })
        .catch((profileError: Error) => {
          if (
            !active ||
            !mounted.current ||
            profileLoadVersion.current !== loadVersion ||
            currentUserId.current !== userId ||
            currentEmail.current !== email
          ) {
            return;
          }

          setAuthError(profileError.message);
          setStatus("ready");
        });
    }

    async function bootstrap() {
      if (!supabase) {
        profileStorage.clear();
        setStatus("ready");
        return;
      }

      const bootstrapVersion = profileLoadVersion.current;
      const { data, error } = await supabase.auth.getSession();

      if (!active || profileLoadVersion.current !== bootstrapVersion) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      beginProfileLoad(null, data.session);
    }

    bootstrap();

    const subscription = supabase?.auth.onAuthStateChange((event, nextSession) => {
      beginProfileLoad(event, nextSession);
    });

    return () => {
      active = false;
      mounted.current = false;
      ++identityVersion.current;
      ++profileLoadVersion.current;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    await startGoogleSignIn(setAuthError);
  }

  async function signInWithApple() {
    if (!supabase) {
      setAuthError(
        "Supabase is not configured. Set Expo public Supabase environment variables.",
      );
      return;
    }

    setAuthError(null);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken || !credential.authorizationCode) {
        throw new Error(
          "Apple did not return the credentials required to complete sign-in.",
        );
      }

      const signIn = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (signIn.error) {
        throw signIn.error;
      }

      if (!signIn.data.session?.access_token) {
        throw new Error("Apple sign-in did not return an authenticated session.");
      }

      try {
        await api.auth.apple.storeCredential(credential.authorizationCode, {
          authToken: signIn.data.session.access_token,
        });
      } catch {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error(
          "Apple sign-in could not be completed securely. Please try again.",
        );
      }

      const nameParts = [
        credential.fullName?.givenName,
        credential.fullName?.middleName,
        credential.fullName?.familyName,
      ].filter((part): part is string => Boolean(part));

      if (nameParts.length > 0) {
        const metadata = await supabase.auth.updateUser({
          data: {
            full_name: nameParts.join(" "),
            given_name: credential.fullName?.givenName,
            family_name: credential.fullName?.familyName,
          },
        });

        if (metadata.error) {
          setAuthError(
            "Signed in, but your Apple profile name could not be saved. You can enter it during setup.",
          );
        }
      }
    } catch (error) {
      if (!isAppleCancellation(error)) {
        setAuthError(errorMessage(error));
      }
    }
  }

  async function refreshProfile() {
    const userId = session?.user.id;
    const email = session?.user.email;

    if (!userId || !email) {
      setProfile(null);
      return;
    }

    const identity = identityVersion.current;
    const loadVersion = ++profileLoadVersion.current;
    const freshProfile = await api.profile.get(email);

    if (
      mounted.current &&
      currentUserId.current === userId &&
      currentEmail.current === email &&
      identityVersion.current === identity &&
      profileLoadVersion.current === loadVersion
    ) {
      cacheProfile(userId, freshProfile);
      setProfile(freshProfile);
    }
  }

  async function saveProfile(data: ProfileInput) {
    const userId = session?.user.id;
    const email = session?.user.email;
    const authToken = session?.access_token;
    const previousHomeCurrency = profile?.home_currency.toUpperCase();

    if (!userId || !email || !authToken) {
      throw new Error("Sign in before saving a profile.");
    }

    const identity = identityVersion.current;
    const savedProfile = await api.profile.save(
      {
        ...data,
        email,
        home_currency: data.home_currency.toUpperCase(),
      },
      { authToken },
    );
    const savedHomeCurrency = savedProfile.home_currency.toUpperCase();

    if (
      mounted.current &&
      currentUserId.current === userId &&
      currentEmail.current === email &&
      identityVersion.current === identity
    ) {
      ++profileLoadVersion.current;
      setProfile(savedProfile);
      setStatus("ready");
      profileStorage.set(userId, savedProfile);

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["profile", email] }),
      ];

      if (previousHomeCurrency !== savedHomeCurrency) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
          queryClient.invalidateQueries({ queryKey: ["tournament"] }),
          queryClient.invalidateQueries({ queryKey: ["fx-rate"] }),
        );
      }

      await Promise.all(invalidations);
    }

    return savedProfile;
  }

  function clearLocalAuthState(userId: string | null) {
    ++identityVersion.current;
    ++profileLoadVersion.current;
    currentUserId.current = null;
    currentEmail.current = null;
    setSession(null);
    setProfile(null);
    setStatus("ready");
    profileStorage.clear();
    if (userId) {
      draftStorage.clear(tournamentDraftStorageKey(userId));
    }
    clearLegacyTournamentDraft();
    queryClient.clear();
  }

  async function signOut() {
    const userId = currentUserId.current;
    clearLocalAuthState(userId);

    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  async function deleteAccount() {
    const userId = currentUserId.current;

    if (!userId) {
      throw new Error("Sign in before deleting your account.");
    }

    const identity = identityVersion.current;
    await api.profile.delete({ authenticatedUserId: userId });

    if (
      !mounted.current ||
      currentUserId.current !== userId ||
      identityVersion.current !== identity
    ) {
      draftStorage.clear(tournamentDraftStorageKey(userId));
      return;
    }

    clearLocalAuthState(userId);

    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // The backend has already deleted the Auth user. Local application
        // state is authoritative here, so a stale-session error cannot restore it.
      }
    }

    router.replace("/login");
  }

  function isCurrentUser(userId: string) {
    return currentUserId.current === userId;
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        status,
        authError,
        signInWithApple,
        signInWithGoogle,
        refreshProfile,
        saveProfile,
        deleteAccount,
        signOut,
        isCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
