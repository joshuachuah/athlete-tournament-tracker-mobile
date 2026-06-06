import { createContext, type PropsWithChildren, use, useEffect, useState } from "react";
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

async function loadProfileForEmail(email: string): Promise<AthleteProfile | null> {
  const profile = await api.profile.get(email);

  if (profile) {
    profileStorage.set(profile);
  } else {
    profileStorage.clear();
  }

  return profile;
}

function redirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: "athletetracker",
    path: "auth/callback",
  });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AthleteProfile | null>(() =>
    profileStorage.get(),
  );
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [authError, setAuthError] = useState<string | null>(
    hasSupabaseConfig
      ? null
      : "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!supabase) {
        setStatus("ready");
        return;
      }

      const cachedProfile = profileStorage.get();
      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      const nextSession = data.session;
      setSession(nextSession);

      const email = nextSession?.user.email;
      if (!email) {
        setProfile(null);
        profileStorage.clear();
        setStatus("ready");
        return;
      }

      if (cachedProfile?.email === email) {
        setProfile(cachedProfile);
        setStatus("ready");
        loadProfileForEmail(email)
          .then((freshProfile) => {
            if (active) {
              setProfile(freshProfile);
            }
          })
          .catch((profileError: Error) => {
            if (active) {
              setAuthError(profileError.message);
            }
          });
        return;
      }

      try {
        setProfile(await loadProfileForEmail(email));
      } catch (profileError) {
        setAuthError((profileError as Error).message);
      } finally {
        if (active) {
          setStatus("ready");
        }
      }
    }

    bootstrap();

    const subscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      const email = nextSession?.user.email;

      if (!email) {
        setProfile(null);
        profileStorage.clear();
        return;
      }

      loadProfileForEmail(email)
        .then(setProfile)
        .catch((profileError: Error) => setAuthError(profileError.message));
    });

    return () => {
      active = false;
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
    const email = session?.user.email;

    if (!email) {
      setProfile(null);
      return;
    }

    setProfile(await loadProfileForEmail(email));
  }

  async function saveProfile(data: ProfileInput) {
    const email = session?.user.email;

    if (!email) {
      throw new Error("Sign in before saving a profile.");
    }

    const savedProfile = await api.profile.save({
      ...data,
      email,
      home_currency: data.home_currency.toUpperCase(),
    });

    setProfile(savedProfile);
    profileStorage.set(savedProfile);
    queryClient.invalidateQueries({ queryKey: ["profile", email] });
    return savedProfile;
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setSession(null);
    setProfile(null);
    profileStorage.clear();
    queryClient.clear();
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
