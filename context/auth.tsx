import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import { api } from "@/lib/api";
import { createAppleAuthRequest } from "@/lib/apple-auth";
import { oauthRedirectUri } from "@/lib/auth-redirect";
import { clearOnboardingDraft } from "@/lib/onboarding";
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
  profileLoadError: string | null;
  requestEmailCode: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (data: ProfileInput) => Promise<AthleteProfile>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  isCurrentUser: (userId: string) => boolean;
};

type ProfileState = {
  profile: AthleteProfile | null;
  profileLoadError: string | null;
  session: Session | null;
  status: "loading" | "ready";
};

type ProfileRequestToken = {
  email: string;
  identity: number;
  loadVersion: number;
  userId: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const PROFILE_LOAD_FALLBACK_MESSAGE =
  "We couldn't load your profile. Check your connection and try again.";
const GOOGLE_OAUTH_START_ERROR =
  "Google sign-in couldn't start. Please try again.";
const GOOGLE_OAUTH_BROWSER_ERROR =
  "Google sign-in couldn't open. Please try again.";
const GOOGLE_OAUTH_SESSION_ERROR =
  "Google sign-in couldn't be completed. Please try again.";

function profileLoadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return PROFILE_LOAD_FALLBACK_MESSAGE;
}

function cacheProfile(userId: string, profile: AthleteProfile | null): void {
  if (profile) {
    profileStorage.set(userId, profile);
  } else {
    profileStorage.clear();
  }
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
  const callbackUrl = oauthRedirectUri();
  let authorization;

  try {
    authorization = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
      },
    });
  } catch {
    setAuthError(GOOGLE_OAUTH_START_ERROR);
    return;
  }

  const { data, error } = authorization;

  if (error) {
    setAuthError(error.message);
    return;
  }

  if (!data.url) {
    setAuthError("Supabase did not return an OAuth URL.");
    return;
  }

  let result;

  try {
    result = await WebBrowser.openAuthSessionAsync(data.url, callbackUrl);
  } catch {
    setAuthError(GOOGLE_OAUTH_BROWSER_ERROR);
    return;
  }

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
    let exchange;

    try {
      exchange = await supabase.auth.exchangeCodeForSession(code);
    } catch {
      setAuthError(GOOGLE_OAUTH_SESSION_ERROR);
      return;
    }

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

async function startAppleSignIn(
  setAuthError: (error: string | null) => void,
) {
  if (!supabase) {
    setAuthError(
      "Supabase is not configured. Set Expo public Supabase environment variables.",
    );
    return;
  }

  setAuthError(null);

  try {
    const request = await createAppleAuthRequest();
    const credential = await AppleAuthentication.signInAsync({
      nonce: request.hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      state: request.state,
    });

    if (credential.state !== request.state) {
      throw new Error("Apple sign-in response could not be verified.");
    }

    if (!credential.identityToken || !credential.authorizationCode) {
      throw new Error(
        "Apple did not return the credentials required to complete sign-in.",
      );
    }

    const signIn = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: request.rawNonce,
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

function useProfileBootstrap(
  setProfileState: Dispatch<SetStateAction<ProfileState>>,
  setAuthError: Dispatch<SetStateAction<string | null>>,
) {
  const identityVersion = useRef(0);
  const profileLoadVersion = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const currentEmail = useRef<string | null>(null);
  const mounted = useRef(true);

  function beginProfileRequest(
    currentSession: Session | null,
  ): ProfileRequestToken | null {
    const userId = currentSession?.user.id;
    const email = currentSession?.user.email;

    if (!userId || !email) {
      return null;
    }

    return {
      email,
      identity: identityVersion.current,
      loadVersion: ++profileLoadVersion.current,
      userId,
    };
  }

  function isCurrentProfileRequest(request: ProfileRequestToken) {
    return (
      mounted.current &&
      currentUserId.current === request.userId &&
      currentEmail.current === request.email &&
      identityVersion.current === request.identity &&
      profileLoadVersion.current === request.loadVersion
    );
  }

  function isCurrentIdentity(userId: string, email: string, identity: number) {
    return (
      mounted.current &&
      currentUserId.current === userId &&
      currentEmail.current === email &&
      identityVersion.current === identity
    );
  }

  function isCurrentUserIdentity(userId: string, identity: number) {
    return (
      mounted.current &&
      currentUserId.current === userId &&
      identityVersion.current === identity
    );
  }

  function clearIdentity() {
    ++identityVersion.current;
    ++profileLoadVersion.current;
    currentUserId.current = null;
    currentEmail.current = null;
  }

  useEffect(() => {
    let active = true;
    mounted.current = true;

    function updateProfileState(nextState: Partial<ProfileState>) {
      setProfileState((currentState) => ({ ...currentState, ...nextState }));
    }

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
      updateProfileState({ session: nextSession, profileLoadError: null });

      if (!userId || !email) {
        updateProfileState({ profile: null, status: "ready" });
        profileStorage.clear();
        return;
      }

      const cachedProfile = profileStorage.getForUser(userId);
      updateProfileState({
        profile: cachedProfile,
        status: cachedProfile ? "ready" : "loading",
      });

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
          updateProfileState({
            profile: freshProfile,
            profileLoadError: null,
            status: "ready",
          });
        })
        .catch((profileError: unknown) => {
          if (
            !active ||
            !mounted.current ||
            profileLoadVersion.current !== loadVersion ||
            currentUserId.current !== userId ||
            currentEmail.current !== email
          ) {
            return;
          }
          updateProfileState({
            profileLoadError: profileLoadErrorMessage(profileError),
            status: "ready",
          });
        });
    }

    async function bootstrap() {
      if (!supabase) {
        profileStorage.clear();
        updateProfileState({ status: "ready" });
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
  }, [setAuthError, setProfileState]);

  return {
    beginProfileRequest,
    clearIdentity,
    currentUserId: () => currentUserId.current,
    identityVersion: () => identityVersion.current,
    invalidateProfileLoads: () => ++profileLoadVersion.current,
    isCurrentIdentity,
    isCurrentProfileRequest,
    isCurrentUserIdentity,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [{ profile, profileLoadError, session, status }, setProfileState] =
    useState<ProfileState>({
      profile: null,
      profileLoadError: null,
      session: null,
      status: "loading",
    });
  const [authError, setAuthError] = useState<string | null>(
    hasSupabaseConfig
      ? null
      : "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
  const googleSignInPromise = useRef<Promise<void> | null>(null);
  const {
    beginProfileRequest,
    clearIdentity,
    currentUserId,
    identityVersion,
    invalidateProfileLoads,
    isCurrentIdentity,
    isCurrentProfileRequest,
    isCurrentUserIdentity,
  } = useProfileBootstrap(setProfileState, setAuthError);

  function updateProfileState(nextState: Partial<ProfileState>) {
    setProfileState((currentState) => ({ ...currentState, ...nextState }));
  }

  function signInWithGoogle() {
    if (googleSignInPromise.current) {
      return googleSignInPromise.current;
    }

    const request = startGoogleSignIn(setAuthError).finally(() => {
      if (googleSignInPromise.current === request) {
        googleSignInPromise.current = null;
      }
    });
    googleSignInPromise.current = request;
    return request;
  }

  async function requestEmailCode(email: string) {
    if (!supabase) {
      setAuthError(
        "Supabase is not configured. Set Expo public Supabase environment variables.",
      );
      return false;
    }

    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });

    if (error) {
      setAuthError(error.message);
      return false;
    }

    return true;
  }

  async function verifyEmailCode(email: string, code: string) {
    if (!supabase) {
      setAuthError(
        "Supabase is not configured. Set Expo public Supabase environment variables.",
      );
      return false;
    }

    setAuthError(null);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });

    if (error) {
      setAuthError(error.message);
      return false;
    }

    if (!data.session?.access_token) {
      setAuthError(
        "The code was accepted, but no authenticated session was created. Request a new code and try again.",
      );
      return false;
    }

    return true;
  }

  async function signInWithApple() {
    await startAppleSignIn(setAuthError);
  }

  async function refreshProfile() {
    const request = beginProfileRequest(session);

    if (!request) {
      updateProfileState({
        profile: null,
        profileLoadError: null,
        status: "ready",
      });
      return;
    }

    updateProfileState({
      profileLoadError: null,
      ...(!profile && { status: "loading" as const }),
    });

    try {
      const freshProfile = await api.profile.get(request.email);

      if (isCurrentProfileRequest(request)) {
        cacheProfile(request.userId, freshProfile);
        updateProfileState({
          profile: freshProfile,
          profileLoadError: null,
          status: "ready",
        });
      }
    } catch (profileError) {
      if (isCurrentProfileRequest(request)) {
        updateProfileState({
          profileLoadError: profileLoadErrorMessage(profileError),
          status: "ready",
        });
        throw profileError;
      }
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

    const identity = identityVersion();
    const savedProfile = await api.profile.save(
      {
        ...data,
        email,
        home_currency: data.home_currency.toUpperCase(),
      },
      { authToken },
    );
    const savedHomeCurrency = savedProfile.home_currency.toUpperCase();

    if (isCurrentIdentity(userId, email, identity)) {
      invalidateProfileLoads();
      updateProfileState({
        profile: savedProfile,
        profileLoadError: null,
        status: "ready",
      });
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
    clearIdentity();
    updateProfileState({
      session: null,
      profile: null,
      profileLoadError: null,
      status: "ready",
    });
    profileStorage.clear();
    if (userId) {
      draftStorage.clear(tournamentDraftStorageKey(userId));
      clearOnboardingDraft(userId);
    }
    clearLegacyTournamentDraft();
    queryClient.clear();
  }

  async function signOut() {
    const userId = currentUserId();
    const identity = identityVersion();

    if (supabase) {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    }

    if (userId && !isCurrentUserIdentity(userId, identity)) {
      draftStorage.clear(tournamentDraftStorageKey(userId));
      clearOnboardingDraft(userId);

      if (!currentUserId()) {
        clearLegacyTournamentDraft();
      }
      return;
    }

    clearLocalAuthState(userId);
  }

  async function deleteAccount() {
    const userId = currentUserId();

    if (!userId) {
      throw new Error("Sign in before deleting your account.");
    }

    const identity = identityVersion();
    const identityIsCurrent = await api.profile
      .delete({ authenticatedUserId: userId })
      .then(() => isCurrentUserIdentity(userId, identity));

    if (!identityIsCurrent) {
      draftStorage.clear(tournamentDraftStorageKey(userId));
      clearOnboardingDraft(userId);
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
    return currentUserId() === userId;
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        status,
        authError,
        profileLoadError,
        requestEmailCode,
        verifyEmailCode,
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
