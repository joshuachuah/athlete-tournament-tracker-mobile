import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";

import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { profileStorage } from "@/lib/storage";
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
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (data: ProfileInput) => Promise<AthleteProfile>;
  signOut: () => Promise<void>;
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

    const callback = new URL(result.url);
    const code = callback.searchParams.get("code");

    if (code) {
      const exchange = await supabase.auth.exchangeCodeForSession(code);
      if (exchange.error) {
        setAuthError(exchange.error.message);
      }
      return;
    }

    const hash = new URLSearchParams(callback.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    if (accessToken && refreshToken) {
      const nextSession = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (nextSession.error) {
        setAuthError(nextSession.error.message);
      }
      return;
    }

    setAuthError("OAuth callback did not include a session code.");
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
    const nextHomeCurrency = data.home_currency.toUpperCase();

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

      if (previousHomeCurrency !== nextHomeCurrency) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
          queryClient.invalidateQueries({ queryKey: ["tournament"] }),
          queryClient.invalidateQueries({ queryKey: ["fx"] }),
        );
      }

      await Promise.all(invalidations);
    }

    return savedProfile;
  }

  async function signOut() {
    ++identityVersion.current;
    ++profileLoadVersion.current;
    currentUserId.current = null;
    currentEmail.current = null;
    setSession(null);
    setProfile(null);
    setStatus("ready");
    profileStorage.clear();
    queryClient.clear();

    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        status,
        authError,
        signInWithGoogle,
        refreshProfile,
        saveProfile,
        signOut,
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
