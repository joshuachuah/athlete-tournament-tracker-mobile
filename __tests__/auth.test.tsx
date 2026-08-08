import { createRef, useImperativeHandle, type RefObject } from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import type { Session } from "@supabase/supabase-js";

import { AuthProvider, useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { createAppleAuthRequest } from "@/lib/apple-auth";
import { getOnboardingDraft, saveOnboardingDraft } from "@/lib/onboarding";
import { queryClient } from "@/lib/query-client";
import {
  draftStorage,
  profileStorage,
  tournamentDraftStorageKey,
} from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { AthleteProfile } from "@/types";

let mockAuthStateCallback:
  | ((event: string, session: Session | null) => void)
  | undefined;

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: {
    EMAIL: 0,
    FULL_NAME: 1,
  },
  AppleAuthenticationUserDetectionStatus: {
    LIKELY_REAL: 2,
    UNKNOWN: 1,
  },
  signInAsync: jest.fn(),
}));

jest.mock("@/lib/apple-auth", () => ({
  createAppleAuthRequest: jest.fn(),
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
  WebBrowserResultType: { CANCEL: "cancel" },
}));

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock("expo-sqlite/localStorage/install", () => {
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });

  return {};
});

jest.mock("@/lib/api", () => ({
  api: {
    auth: {
      apple: {
        storeCredential: jest.fn(),
      },
    },
    profile: {
      delete: jest.fn(),
      get: jest.fn(),
      save: jest.fn(),
    },
  },
}));

jest.mock("@/lib/supabase", () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      exchangeCodeForSession: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(
        (callback: (event: string, session: Session | null) => void) => {
          mockAuthStateCallback = callback;
          return {
            data: { subscription: { unsubscribe: jest.fn() } },
          };
        },
      ),
      setSession: jest.fn(),
      signInWithIdToken: jest.fn(),
      signInWithOAuth: jest.fn(),
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
      updateUser: jest.fn(),
      verifyOtp: jest.fn(),
    },
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function session(
  email: string,
  userId = email,
  accessToken = `token:${userId}`,
): Session {
  return { access_token: accessToken, user: { email, id: userId } } as Session;
}

function profile(id: string, email: string): AthleteProfile {
  return {
    id,
    email,
    name: id,
    home_country: "MY",
    home_currency: "MYR",
    sport: "tennis",
    monthly_income: 0,
    savings_balance: 0,
    monthly_sponsorship: 0,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const mockAuth = supabase!.auth as unknown as {
  getSession: jest.Mock;
  signOut: jest.Mock;
};
const mockGetSession = mockAuth.getSession;
const mockSignOut = mockAuth.signOut;

type AuthProbe = Pick<
  ReturnType<typeof useAuth>,
  | "deleteAccount"
  | "refreshProfile"
  | "requestEmailCode"
  | "saveProfile"
  | "signInWithApple"
  | "signInWithGoogle"
  | "signOut"
  | "verifyEmailCode"
>;

function AuthState({ authRef }: { authRef: RefObject<AuthProbe | null> }) {
  const auth = useAuth();
  useImperativeHandle(authRef, () => ({
    deleteAccount: auth.deleteAccount,
    refreshProfile: auth.refreshProfile,
    requestEmailCode: auth.requestEmailCode,
    saveProfile: auth.saveProfile,
    signInWithApple: auth.signInWithApple,
    signInWithGoogle: auth.signInWithGoogle,
    signOut: auth.signOut,
    verifyEmailCode: auth.verifyEmailCode,
  }));

  return (
    <View>
      <Text testID="session-email">{auth.session?.user.email ?? "none"}</Text>
      <Text testID="session-user-id">{auth.session?.user.id ?? "none"}</Text>
      <Text testID="profile-email">{auth.profile?.email ?? "none"}</Text>
      <Text testID="profile-name">{auth.profile?.name ?? "none"}</Text>
      <Text testID="status">{auth.status}</Text>
      <Text testID="auth-error">{auth.authError ?? "none"}</Text>
      <Text testID="profile-load-error">
        {auth.profileLoadError ?? "none"}
      </Text>
    </View>
  );
}

function renderAuthProvider() {
  const authRef = createRef<AuthProbe>();
  const screen = render(
    <AuthProvider>
      <AuthState authRef={authRef} />
    </AuthProvider>,
  );

  return { authRef, screen };
}

const mockOpenAuthSession =
  WebBrowser.openAuthSessionAsync as jest.MockedFunction<
    typeof WebBrowser.openAuthSessionAsync
  >;
const mockExchangeCodeForSession = supabase!.auth
  .exchangeCodeForSession as jest.Mock;
const mockSetSession = supabase!.auth.setSession as jest.Mock;
const mockSignInWithOAuth = supabase!.auth.signInWithOAuth as jest.Mock;
const mockSignInWithIdToken = supabase!.auth.signInWithIdToken as jest.Mock;
const mockSignInWithOtp = supabase!.auth.signInWithOtp as jest.Mock;
const mockUpdateUser = supabase!.auth.updateUser as jest.Mock;
const mockVerifyOtp = supabase!.auth.verifyOtp as jest.Mock;
const mockAppleSignIn =
  AppleAuthentication.signInAsync as jest.MockedFunction<
    typeof AppleAuthentication.signInAsync
  >;
const mockStoreAppleCredential = api.auth.apple
  .storeCredential as jest.MockedFunction<
  typeof api.auth.apple.storeCredential
>;
const mockCreateAppleAuthRequest =
  createAppleAuthRequest as jest.MockedFunction<typeof createAppleAuthRequest>;

describe("AuthProvider OAuth callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    queryClient.clear();
    mockAuthStateCallback = undefined;
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInWithOAuth.mockResolvedValue({
      data: { provider: "google", url: "https://auth.example.test/authorize" },
      error: null,
    });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
  });

  async function startSignIn() {
    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    await act(async () => {
      await authRef.current!.signInWithGoogle();
    });

    return screen;
  }

  it("exchanges a one-time callback code exactly once", async () => {
    mockOpenAuthSession.mockResolvedValue({
      type: "success",
      url: "athletetracker://auth/callback?code=one-time-code",
    });

    const screen = await startSignIn();

    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe("none");
  });

  it("leaves sign-in usable when the browser session is cancelled", async () => {
    mockOpenAuthSession.mockResolvedValue({
      type: WebBrowser.WebBrowserResultType.CANCEL,
    });

    const screen = await startSignIn();

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe("none");
  });

  it("reports a provider rejection without exposing callback details", async () => {
    mockOpenAuthSession.mockResolvedValue({
      type: "success",
      url: "athletetracker://auth/callback?error=access_denied&error_description=sensitive-detail",
    });

    const screen = await startSignIn();

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "OAuth sign-in was rejected by the provider.",
    );
  });

  it("rejects a callback without a code", async () => {
    mockOpenAuthSession.mockResolvedValue({
      type: "success",
      url: "athletetracker://auth/callback",
    });

    const screen = await startSignIn();

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "OAuth callback did not include a session code.",
    );
  });

  it("rejects a malformed callback URL", async () => {
    mockOpenAuthSession.mockResolvedValue({
      type: "success",
      url: "not a callback URL",
    });

    const screen = await startSignIn();

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "OAuth callback URL was invalid.",
    );
  });

  it("rejects reusable bearer tokens in a callback fragment", async () => {
    mockOpenAuthSession.mockResolvedValue({
      type: "success",
      url: "athletetracker://auth/callback#access_token=access-secret&refresh_token=refresh-secret",
    });

    const screen = await startSignIn();

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "OAuth callback did not include a valid session code.",
    );
  });
});

describe("AuthProvider email sign-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    queryClient.clear();
    mockAuthStateCallback = undefined;
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });
    mockVerifyOtp.mockResolvedValue({
      data: {
        session: session("athlete@example.com", "email-user"),
        user: null,
      },
      error: null,
    });
  });

  it("requests a one-time code that can create a new account", async () => {
    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    let sent = false;
    await act(async () => {
      sent = await authRef.current!.requestEmailCode("  Athlete@Example.com ");
    });

    expect(sent).toBe(true);
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "athlete@example.com",
      options: { shouldCreateUser: true },
    });
    expect(screen.getByTestId("auth-error").props.children).toBe("none");
  });

  it("verifies the email code without putting credentials in a callback URL", async () => {
    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    let verified = false;
    await act(async () => {
      verified = await authRef.current!.verifyEmailCode(
        "Athlete@Example.com",
        " 123456 ",
      );
    });

    expect(verified).toBe(true);
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "athlete@example.com",
      token: "123456",
      type: "email",
    });
    expect(screen.getByTestId("auth-error").props.children).toBe("none");
  });

  it("rejects a verification response that does not create a session", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    let verified = true;
    await act(async () => {
      verified = await authRef.current!.verifyEmailCode(
        "athlete@example.com",
        "123456",
      );
    });

    expect(verified).toBe(false);
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "The code was accepted, but no authenticated session was created. Request a new code and try again.",
    );
  });

  it("keeps the email form on screen when Supabase rejects the request", async () => {
    mockSignInWithOtp.mockResolvedValue({
      data: {},
      error: new Error("Please wait before requesting another code."),
    });
    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    let sent = true;
    await act(async () => {
      sent = await authRef.current!.requestEmailCode("athlete@example.com");
    });

    expect(sent).toBe(false);
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "Please wait before requesting another code.",
    );
  });
});

describe("AuthProvider Apple sign-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    queryClient.clear();
    mockAuthStateCallback = undefined;
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInWithIdToken.mockResolvedValue({
      data: {
        session: session(
          "athlete@privaterelay.appleid.com",
          "apple-user",
          "apple-session-token",
        ),
        user: null,
      },
      error: null,
    });
    mockStoreAppleCredential.mockResolvedValue({ success: true });
    mockCreateAppleAuthRequest.mockResolvedValue({
      rawNonce: "raw-nonce",
      hashedNonce: "hashed-nonce",
      state: "apple-state",
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
  });

  async function startAppleSignIn() {
    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    await act(async () => {
      await authRef.current!.signInWithApple();
    });

    return screen;
  }

  it("exchanges the native identity token and preserves the first Apple name", async () => {
    mockAppleSignIn.mockResolvedValue({
      authorizationCode: "authorization-code",
      email: "athlete@privaterelay.appleid.com",
      fullName: {
        familyName: "Athlete",
        givenName: "Alex",
        middleName: null,
        namePrefix: null,
        nameSuffix: null,
        nickname: null,
      },
      identityToken: "apple-identity-token",
      realUserStatus: AppleAuthentication.AppleAuthenticationUserDetectionStatus.LIKELY_REAL,
      state: "apple-state",
      user: "apple-user",
    });

    const screen = await startAppleSignIn();

    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      nonce: "raw-nonce",
      provider: "apple",
      token: "apple-identity-token",
    });
    expect(mockAppleSignIn).toHaveBeenCalledWith({
      nonce: "hashed-nonce",
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      state: "apple-state",
    });
    expect(mockStoreAppleCredential).toHaveBeenCalledWith(
      "authorization-code",
      { authToken: "apple-session-token" },
    );
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: {
        family_name: "Athlete",
        full_name: "Alex Athlete",
        given_name: "Alex",
      },
    });
    expect(screen.getByTestId("auth-error").props.children).toBe("none");
  });

  it("keeps Apple sign-in usable after user cancellation", async () => {
    mockAppleSignIn.mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });

    const screen = await startAppleSignIn();

    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe("none");
  });

  it("rejects an Apple response without an identity token", async () => {
    mockAppleSignIn.mockResolvedValue({
      authorizationCode: null,
      email: null,
      fullName: null,
      identityToken: null,
      realUserStatus: AppleAuthentication.AppleAuthenticationUserDetectionStatus.UNKNOWN,
      state: "apple-state",
      user: "apple-user",
    });

    const screen = await startAppleSignIn();

    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "Apple did not return the credentials required to complete sign-in.",
    );
  });

  it("clears the local Apple session when revocation storage fails", async () => {
    mockAppleSignIn.mockResolvedValue({
      authorizationCode: "authorization-code",
      email: null,
      fullName: null,
      identityToken: "apple-identity-token",
      realUserStatus:
        AppleAuthentication.AppleAuthenticationUserDetectionStatus.UNKNOWN,
      state: "apple-state",
      user: "apple-user",
    });
    mockStoreAppleCredential.mockRejectedValue(
      new Error("provider unavailable"),
    );

    const screen = await startAppleSignIn();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "Apple sign-in could not be completed securely. Please try again.",
    );
  });

  it("rejects an Apple response with a mismatched state", async () => {
    mockAppleSignIn.mockResolvedValue({
      authorizationCode: "authorization-code",
      email: null,
      fullName: null,
      identityToken: "apple-identity-token",
      realUserStatus:
        AppleAuthentication.AppleAuthenticationUserDetectionStatus.UNKNOWN,
      state: "different-state",
      user: "apple-user",
    });

    const screen = await startAppleSignIn();

    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-error").props.children).toBe(
      "Apple sign-in response could not be verified.",
    );
  });
});

describe("AuthProvider profile isolation", () => {
  const firstProfile = profile("athlete-1", "first@example.com");
  const secondProfile = profile("athlete-2", "second@example.com");
  const firstUserId = "auth-user-1";
  const secondUserId = "auth-user-2";
  const getProfile = api.profile.get as jest.MockedFunction<typeof api.profile.get>;
  const saveProfile = api.profile.save as jest.MockedFunction<
    typeof api.profile.save
  >;
  const deleteProfile = api.profile.delete as jest.MockedFunction<
    typeof api.profile.delete
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    queryClient.clear();
    mockAuthStateCallback = undefined;
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("clears a stale cache when bootstrap has no authenticated session", async () => {
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("keeps the same-account cache when its background refresh fails", async () => {
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockRejectedValue(new Error("refresh unavailable"));

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-load-error").props.children).toBe(
        "refresh unavailable",
      );
    });

    expect(screen.getByTestId("auth-error").props.children).toBe("none");
    expect(screen.getByTestId("profile-email").props.children).toBe(
      firstProfile.email,
    );
    expect(profileStorage.get()).toEqual(firstProfile);
  });

  it("keeps a failed initial load distinct and recovers on retry", async () => {
    const retry = deferred<AthleteProfile | null>();
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile
      .mockRejectedValueOnce(new Error("profile unavailable"))
      .mockReturnValueOnce(retry.promise);

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-load-error").props.children).toBe(
        "profile unavailable",
      );
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(screen.getByTestId("auth-error").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = authRef.current!.refreshProfile();
    });

    expect(screen.getByTestId("status").props.children).toBe("loading");
    expect(screen.getByTestId("profile-load-error").props.children).toBe(
      "none",
    );

    await act(async () => {
      retry.resolve(firstProfile);
      await refreshPromise;
    });

    expect(screen.getByTestId("status").props.children).toBe("ready");
    expect(screen.getByTestId("profile-email").props.children).toBe(
      firstProfile.email,
    );
    expect(screen.getByTestId("profile-load-error").props.children).toBe(
      "none",
    );
    expect(profileStorage.get()).toEqual(firstProfile);
  });

  it.each([
    ["an empty error", new Error("")],
    ["a non-Error rejection", { reason: "unavailable" }],
  ])("normalizes %s to a blocking fallback", async (_, rejection) => {
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockRejectedValue(rejection);

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-load-error").props.children).toBe(
        "We couldn't load your profile. Check your connection and try again.",
      );
    });

    expect(screen.getByTestId("status").props.children).toBe("ready");
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(screen.getByTestId("auth-error").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();
  });

  it("ignores a failed profile request superseded by a new identity", async () => {
    const firstLoad = deferred<AthleteProfile | null>();
    const secondLoad = deferred<AthleteProfile | null>();
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockImplementation((email) =>
      email === firstProfile.email ? firstLoad.promise : secondLoad.promise,
    );

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(getProfile).toHaveBeenCalledWith(firstProfile.email);
    });

    act(() => {
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(secondProfile.email, secondUserId),
      );
    });

    await act(async () => {
      secondLoad.resolve(secondProfile);
      await secondLoad.promise;
    });

    await act(async () => {
      firstLoad.reject(new Error("stale profile failure"));
      await expect(firstLoad.promise).rejects.toThrow("stale profile failure");
    });

    expect(screen.getByTestId("session-user-id").props.children).toBe(
      secondUserId,
    );
    expect(screen.getByTestId("profile-email").props.children).toBe(
      secondProfile.email,
    );
    expect(screen.getByTestId("profile-load-error").props.children).toBe(
      "none",
    );
  });

  it("clears the current profile when the server returns null", async () => {
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockResolvedValue(null);

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(profileStorage.get()).toBeNull();
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
  });

  it("clears the previous account synchronously and ignores its late refresh", async () => {
    const firstRefresh = deferred<AthleteProfile | null>();
    const secondLoad = deferred<AthleteProfile | null>();
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockImplementation((email) =>
      email === firstProfile.email ? firstRefresh.promise : secondLoad.promise,
    );

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    act(() => {
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(secondProfile.email, secondUserId),
      );
    });

    expect(screen.getByTestId("session-email").props.children).toBe(
      secondProfile.email,
    );
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(screen.getByTestId("status").props.children).toBe("loading");
    expect(profileStorage.get()).toBeNull();

    await act(async () => {
      secondLoad.resolve(secondProfile);
      await secondLoad.promise;
    });

    expect(screen.getByTestId("profile-email").props.children).toBe(
      secondProfile.email,
    );
    expect(profileStorage.get()).toEqual(secondProfile);

    await act(async () => {
      firstRefresh.resolve(firstProfile);
      await firstRefresh.promise;
    });

    expect(screen.getByTestId("profile-email").props.children).toBe(
      secondProfile.email,
    );
    expect(profileStorage.get()).toEqual(secondProfile);
  });

  it("removes private tournament data before the next subject can read it", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockReturnValue(new Promise(() => undefined));

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("session-user-id").props.children).toBe(
        firstUserId,
      );
    });

    const privateTournament = { id: "shared-tournament", name: "Account A" };
    queryClient.setQueryData(
      ["tournament", privateTournament.id],
      privateTournament,
    );

    act(() => {
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(secondProfile.email, secondUserId),
      );
    });

    expect(screen.getByTestId("session-user-id").props.children).toBe(
      secondUserId,
    );
    expect(
      queryClient.getQueryData(["tournament", privateTournament.id]),
    ).toBeUndefined();
  });

  it("clears private queries for a SIGNED_OUT event even when already signed out", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    queryClient.setQueryData(["tournament", "private"], { id: "private" });

    act(() => {
      mockAuthStateCallback?.("SIGNED_OUT", null);
    });

    expect(queryClient.getQueryData(["tournament", "private"])).toBeUndefined();
  });

  it("isolates deleted and recreated accounts that share an email", async () => {
    const firstLoad = deferred<AthleteProfile | null>();
    const recreatedLoad = deferred<AthleteProfile | null>();
    const recreatedProfile = profile("athlete-recreated", firstProfile.email);
    let loadCount = 0;
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockImplementation(() => {
      loadCount += 1;
      return loadCount === 1 ? firstLoad.promise : recreatedLoad.promise;
    });

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-name").props.children).toBe(
        firstProfile.name,
      );
    });

    act(() => {
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(firstProfile.email, secondUserId),
      );
    });

    expect(screen.getByTestId("profile-name").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();

    await act(async () => {
      recreatedLoad.resolve(recreatedProfile);
      await recreatedLoad.promise;
    });

    await act(async () => {
      firstLoad.resolve(firstProfile);
      await firstLoad.promise;
    });

    expect(screen.getByTestId("session-user-id").props.children).toBe(
      secondUserId,
    );
    expect(screen.getByTestId("profile-name").props.children).toBe(
      recreatedProfile.name,
    );
    expect(profileStorage.getForUser(secondUserId)).toEqual(recreatedProfile);
  });

  it("does not restore another account when the new profile request fails", async () => {
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockImplementation((email) => {
      if (email === firstProfile.email) {
        return new Promise(() => undefined);
      }

      return Promise.reject(new Error("profile unavailable"));
    });

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    act(() => {
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(secondProfile.email, secondUserId),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
      expect(screen.getByTestId("profile-load-error").props.children).toBe(
        "profile unavailable",
      );
    });

    expect(screen.getByTestId("auth-error").props.children).toBe("none");
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();
  });

  it("ignores a bootstrap session superseded by an auth event", async () => {
    const bootstrap = deferred<{
      data: { session: Session };
      error: null;
    }>();
    mockGetSession.mockReturnValue(bootstrap.promise);
    getProfile.mockResolvedValue(secondProfile);

    const { screen } = renderAuthProvider();

    act(() => {
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(secondProfile.email, secondUserId),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        secondProfile.email,
      );
    });

    await act(async () => {
      bootstrap.resolve({
        data: { session: session(firstProfile.email, firstUserId) },
        error: null,
      });
      await bootstrap.promise;
    });

    expect(screen.getByTestId("session-email").props.children).toBe(
      secondProfile.email,
    );
    expect(screen.getByTestId("profile-email").props.children).toBe(
      secondProfile.email,
    );
    expect(profileStorage.get()).toEqual(secondProfile);
  });

  it("keeps a same-account save valid across a token refresh", async () => {
    const tokenRefresh = deferred<AthleteProfile | null>();
    const save = deferred<AthleteProfile>();
    const savedProfile = { ...firstProfile, name: "Updated athlete" };
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockReturnValue(tokenRefresh.promise);
    saveProfile.mockReturnValue(save.promise);

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("session-email").props.children).toBe(
        firstProfile.email,
      );
    });
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(screen.getByTestId("status").props.children).toBe("loading");

    let savePromise!: Promise<AthleteProfile>;
    act(() => {
      savePromise = authRef.current!.saveProfile({
        name: savedProfile.name,
        home_country: savedProfile.home_country,
        home_currency: savedProfile.home_currency,
        sport: savedProfile.sport,
      });
      mockAuthStateCallback?.(
        "TOKEN_REFRESHED",
        session(firstProfile.email, firstUserId, "refreshed-token"),
      );
    });

    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ email: firstProfile.email }),
      { authToken: `token:${firstUserId}` },
    );

    await act(async () => {
      save.resolve(savedProfile);
      await savePromise;
    });

    expect(screen.getByTestId("profile-name").props.children).toBe(
      savedProfile.name,
    );
    expect(screen.getByTestId("status").props.children).toBe("ready");
    expect(profileStorage.get()).toEqual(savedProfile);

    await act(async () => {
      tokenRefresh.resolve(firstProfile);
      await tokenRefresh.promise;
    });

    expect(screen.getByTestId("profile-name").props.children).toBe(
      savedProfile.name,
    );
    expect(profileStorage.get()).toEqual(savedProfile);
  });

  it("invalidates currency-derived query families after the home currency changes", async () => {
    const savedProfile = { ...firstProfile, home_currency: "USD" };
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockReturnValue(new Promise(() => undefined));
    saveProfile.mockResolvedValue(savedProfile);

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    const tournamentListKey = ["tournaments", firstProfile.id];
    const tournamentKey = ["tournament", "tournament-1"];
    const fxKey = ["fx-rate", "MYR", "USD"];
    const unrelatedKey = ["settings", firstProfile.id];
    queryClient.setQueryData(tournamentListKey, [{ id: "tournament-1" }]);
    queryClient.setQueryData(tournamentKey, { id: "tournament-1" });
    queryClient.setQueryData(fxKey, 23.5);
    queryClient.setQueryData(unrelatedKey, { notifications: true });
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await authRef.current!.saveProfile({
        name: savedProfile.name,
        home_country: savedProfile.home_country,
        home_currency: savedProfile.home_currency,
        sport: savedProfile.sport,
      });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["profile", firstProfile.email],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["tournaments"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["tournament"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["fx-rate"] });
    expect(invalidateQueries).toHaveBeenCalledTimes(4);
    expect(queryClient.getQueryState(tournamentListKey)?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(tournamentKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(fxKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
  });

  it("does not invalidate currency-derived queries for the same normalized currency", async () => {
    const savedProfile = { ...firstProfile, name: "Updated athlete" };
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockReturnValue(new Promise(() => undefined));
    saveProfile.mockResolvedValue(savedProfile);

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    const tournamentListKey = ["tournaments", firstProfile.id];
    const tournamentKey = ["tournament", "tournament-1"];
    const fxKey = ["fx-rate", "MYR", "USD"];
    queryClient.setQueryData(tournamentListKey, [{ id: "tournament-1" }]);
    queryClient.setQueryData(tournamentKey, { id: "tournament-1" });
    queryClient.setQueryData(fxKey, 23.5);
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await authRef.current!.saveProfile({
        name: savedProfile.name,
        home_country: savedProfile.home_country,
        home_currency: "myr",
        sport: savedProfile.sport,
      });
    });

    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ home_currency: "MYR" }),
      { authToken: `token:${firstUserId}` },
    );
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["profile", firstProfile.email],
    });
    expect(queryClient.getQueryState(tournamentListKey)?.isInvalidated).toBe(
      false,
    );
    expect(queryClient.getQueryState(tournamentKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(fxKey)?.isInvalidated).toBe(false);
  });

  it("discards a refresh that completes after the account changes", async () => {
    const backgroundLoad = deferred<AthleteProfile | null>();
    const refresh = deferred<AthleteProfile | null>();
    const secondLoad = deferred<AthleteProfile | null>();
    let firstAccountLoads = 0;
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockImplementation((email) => {
      if (email === secondProfile.email) {
        return secondLoad.promise;
      }

      firstAccountLoads += 1;
      return firstAccountLoads === 1 ? backgroundLoad.promise : refresh.promise;
    });

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = authRef.current!.refreshProfile();
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(secondProfile.email, secondUserId),
      );
    });

    await act(async () => {
      refresh.resolve(firstProfile);
      await refreshPromise;
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();

    await act(async () => {
      secondLoad.resolve(secondProfile);
      await secondLoad.promise;
    });

    expect(screen.getByTestId("profile-email").props.children).toBe(
      secondProfile.email,
    );
    expect(profileStorage.get()).toEqual(secondProfile);
  });

  it("discards a save that completes after the account changes", async () => {
    const save = deferred<AthleteProfile>();
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockReturnValue(new Promise(() => undefined));
    saveProfile.mockReturnValue(save.promise);

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");

    let savePromise!: Promise<AthleteProfile>;
    act(() => {
      savePromise = authRef.current!.saveProfile({
        name: firstProfile.name,
        home_country: firstProfile.home_country,
        home_currency: firstProfile.home_currency,
        sport: firstProfile.sport,
      });
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(secondProfile.email, secondUserId),
      );
    });

    await act(async () => {
      save.resolve(firstProfile);
      await savePromise;
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("keeps local sign-out isolated when a load and remote sign-out fail", async () => {
    const secondLoad = deferred<AthleteProfile | null>();
    const remoteSignOut = deferred<{ error: Error | null }>();
    profileStorage.set(firstUserId, firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockImplementation((email) =>
      email === secondProfile.email
        ? secondLoad.promise
        : new Promise(() => undefined),
    );
    mockSignOut.mockReturnValue(remoteSignOut.promise);
    saveOnboardingDraft(secondUserId, {
      step: 2,
      name: "Second Athlete",
      country: "Malaysia",
      currency: "MYR",
      sport: "Squash",
      customCountry: false,
      customCurrency: false,
      customSport: false,
    });

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    act(() => {
      mockAuthStateCallback?.(
        "SIGNED_IN",
        session(secondProfile.email, secondUserId),
      );
    });

    let signOutPromise!: Promise<void>;
    act(() => {
      signOutPromise = authRef.current!.signOut();
    });

    expect(screen.getByTestId("session-email").props.children).toBe("none");
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(screen.getByTestId("status").props.children).toBe("ready");
    expect(profileStorage.get()).toBeNull();
    expect(getOnboardingDraft(secondUserId)).toBeNull();

    await act(async () => {
      secondLoad.resolve(secondProfile);
      await secondLoad.promise;
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();

    remoteSignOut.reject(new Error("remote sign-out failed"));
    await expect(signOutPromise).rejects.toThrow("remote sign-out failed");
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();
  });

  it("preserves the session and private caches when remote deletion fails", async () => {
    const draftKey = tournamentDraftStorageKey(firstUserId);
    profileStorage.set(firstUserId, firstProfile);
    draftStorage.set(draftKey, { private: "draft" });
    saveOnboardingDraft(firstUserId, {
      step: 2,
      name: "First Athlete",
      country: "Malaysia",
      currency: "MYR",
      sport: "Squash",
      customCountry: false,
      customCurrency: false,
      customSport: false,
    });
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockReturnValue(new Promise(() => undefined));
    deleteProfile.mockRejectedValue(new Error("Deletion service unavailable"));

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    queryClient.setQueryData(["tournament", "private"], { id: "private" });

    await expect(authRef.current!.deleteAccount()).rejects.toThrow(
      "Deletion service unavailable",
    );

    expect(deleteProfile).toHaveBeenCalledWith({
      authenticatedUserId: firstUserId,
    });
    expect(screen.getByTestId("session-user-id").props.children).toBe(firstUserId);
    expect(screen.getByTestId("profile-email").props.children).toBe(
      firstProfile.email,
    );
    expect(profileStorage.getForUser(firstUserId)).toEqual(firstProfile);
    expect(draftStorage.get(draftKey)).toEqual({ private: "draft" });
    expect(getOnboardingDraft(firstUserId)).not.toBeNull();
    expect(queryClient.getQueryData(["tournament", "private"])).toEqual({
      id: "private",
    });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("clears private state and navigates after deletion even when local sign-out reports a stale user", async () => {
    const draftKey = tournamentDraftStorageKey(firstUserId);
    profileStorage.set(firstUserId, firstProfile);
    draftStorage.set(draftKey, { private: "draft" });
    saveOnboardingDraft(firstUserId, {
      step: 2,
      name: "First Athlete",
      country: "Malaysia",
      currency: "MYR",
      sport: "Squash",
      customCountry: false,
      customCurrency: false,
      customSport: false,
    });
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockReturnValue(new Promise(() => undefined));
    deleteProfile.mockResolvedValue({ success: true });
    mockSignOut.mockResolvedValue({ error: new Error("User not found") });

    const { authRef, screen } = renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    queryClient.setQueryData(["tournament", "private"], { id: "private" });

    await act(async () => {
      await authRef.current!.deleteAccount();
    });

    expect(screen.getByTestId("session-email").props.children).toBe("none");
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(screen.getByTestId("status").props.children).toBe("ready");
    expect(profileStorage.get()).toBeNull();
    expect(draftStorage.get(draftKey)).toBeNull();
    expect(getOnboardingDraft(firstUserId)).toBeNull();
    expect(queryClient.getQueryData(["tournament", "private"])).toBeUndefined();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(router.replace).toHaveBeenCalledWith("/login");
  });

  it("does not write a pending profile after unmount", async () => {
    const load = deferred<AthleteProfile | null>();
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email, firstUserId) },
      error: null,
    });
    getProfile.mockReturnValue(load.promise);

    const { screen } = renderAuthProvider();

    await waitFor(() => {
      expect(getProfile).toHaveBeenCalledWith(firstProfile.email);
    });

    screen.unmount();
    load.resolve(firstProfile);
    await load.promise;

    expect(profileStorage.get()).toBeNull();
  });
});
