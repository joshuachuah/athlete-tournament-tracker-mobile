import { act, render, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { AuthProvider, useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { profileStorage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { AthleteProfile } from "@/types";

let mockAuthStateCallback:
  | ((event: string, session: Session | null) => void)
  | undefined;

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: jest.fn(() => "athletetracker://auth/callback"),
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
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
    profile: {
      get: jest.fn(),
      save: jest.fn(),
    },
  },
}));

jest.mock("@/lib/query-client", () => ({
  queryClient: {
    clear: jest.fn(),
    invalidateQueries: jest.fn(),
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
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
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

function session(email: string): Session {
  return { user: { email } } as Session;
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

let latestAuth: ReturnType<typeof useAuth> | undefined;

function AuthState() {
  const auth = useAuth();
  latestAuth = auth;

  return (
    <View>
      <Text testID="session-email">{auth.session?.user.email ?? "none"}</Text>
      <Text testID="profile-email">{auth.profile?.email ?? "none"}</Text>
      <Text testID="profile-name">{auth.profile?.name ?? "none"}</Text>
      <Text testID="status">{auth.status}</Text>
      <Text testID="auth-error">{auth.authError ?? "none"}</Text>
    </View>
  );
}

describe("AuthProvider profile isolation", () => {
  const firstProfile = profile("athlete-1", "first@example.com");
  const secondProfile = profile("athlete-2", "second@example.com");
  const getProfile = api.profile.get as jest.MockedFunction<typeof api.profile.get>;
  const saveProfile = api.profile.save as jest.MockedFunction<
    typeof api.profile.save
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    latestAuth = undefined;
    mockAuthStateCallback = undefined;
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("clears a stale cache when bootstrap has no authenticated session", async () => {
    profileStorage.set(firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("keeps the same-account cache when its background refresh fails", async () => {
    profileStorage.set(firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockRejectedValue(new Error("refresh unavailable"));

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-error").props.children).toBe(
        "refresh unavailable",
      );
    });

    expect(screen.getByTestId("profile-email").props.children).toBe(
      firstProfile.email,
    );
    expect(profileStorage.get()).toEqual(firstProfile);
  });

  it("clears the current profile when the server returns null", async () => {
    profileStorage.set(firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockResolvedValue(null);

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(profileStorage.get()).toBeNull();
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
  });

  it("clears the previous account synchronously and ignores its late refresh", async () => {
    const firstRefresh = deferred<AthleteProfile | null>();
    const secondLoad = deferred<AthleteProfile | null>();
    profileStorage.set(firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockImplementation((email) =>
      email === firstProfile.email ? firstRefresh.promise : secondLoad.promise,
    );

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    act(() => {
      mockAuthStateCallback?.("SIGNED_IN", session(secondProfile.email));
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

  it("does not restore another account when the new profile request fails", async () => {
    profileStorage.set(firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockImplementation((email) => {
      if (email === firstProfile.email) {
        return new Promise(() => undefined);
      }

      return Promise.reject(new Error("profile unavailable"));
    });

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    act(() => {
      mockAuthStateCallback?.("SIGNED_IN", session(secondProfile.email));
    });

    await waitFor(() => {
      expect(screen.getByTestId("status").props.children).toBe("ready");
      expect(screen.getByTestId("auth-error").props.children).toBe(
        "profile unavailable",
      );
    });

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

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    act(() => {
      mockAuthStateCallback?.("SIGNED_IN", session(secondProfile.email));
    });

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        secondProfile.email,
      );
    });

    await act(async () => {
      bootstrap.resolve({
        data: { session: session(firstProfile.email) },
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
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockReturnValue(tokenRefresh.promise);
    saveProfile.mockReturnValue(save.promise);

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("session-email").props.children).toBe(
        firstProfile.email,
      );
    });
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(screen.getByTestId("status").props.children).toBe("loading");

    let savePromise!: Promise<AthleteProfile>;
    act(() => {
      savePromise = latestAuth!.saveProfile({
        name: savedProfile.name,
        home_country: savedProfile.home_country,
        home_currency: savedProfile.home_currency,
        sport: savedProfile.sport,
      });
      mockAuthStateCallback?.("TOKEN_REFRESHED", session(firstProfile.email));
    });

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

  it("discards a refresh that completes after the account changes", async () => {
    const backgroundLoad = deferred<AthleteProfile | null>();
    const refresh = deferred<AthleteProfile | null>();
    const secondLoad = deferred<AthleteProfile | null>();
    let firstAccountLoads = 0;
    profileStorage.set(firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockImplementation((email) => {
      if (email === secondProfile.email) {
        return secondLoad.promise;
      }

      firstAccountLoads += 1;
      return firstAccountLoads === 1 ? backgroundLoad.promise : refresh.promise;
    });

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = latestAuth!.refreshProfile();
      mockAuthStateCallback?.("SIGNED_IN", session(secondProfile.email));
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
    profileStorage.set(firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockReturnValue(new Promise(() => undefined));
    saveProfile.mockReturnValue(save.promise);

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    let savePromise!: Promise<AthleteProfile>;
    act(() => {
      savePromise = latestAuth!.saveProfile({
        name: firstProfile.name,
        home_country: firstProfile.home_country,
        home_currency: firstProfile.home_currency,
        sport: firstProfile.sport,
      });
      mockAuthStateCallback?.("SIGNED_IN", session(secondProfile.email));
    });

    await act(async () => {
      save.resolve(firstProfile);
      await savePromise;
    });

    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(profileStorage.get()).toBeNull();
  });

  it("keeps local sign-out isolated when a load and remote sign-out fail", async () => {
    const secondLoad = deferred<AthleteProfile | null>();
    const remoteSignOut = deferred<{ error: Error | null }>();
    profileStorage.set(firstProfile);
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockImplementation((email) =>
      email === secondProfile.email
        ? secondLoad.promise
        : new Promise(() => undefined),
    );
    mockSignOut.mockReturnValue(remoteSignOut.promise);

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile-email").props.children).toBe(
        firstProfile.email,
      );
    });

    act(() => {
      mockAuthStateCallback?.("SIGNED_IN", session(secondProfile.email));
    });

    let signOutPromise!: Promise<void>;
    act(() => {
      signOutPromise = latestAuth!.signOut();
    });

    expect(screen.getByTestId("session-email").props.children).toBe("none");
    expect(screen.getByTestId("profile-email").props.children).toBe("none");
    expect(screen.getByTestId("status").props.children).toBe("ready");
    expect(profileStorage.get()).toBeNull();

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

  it("does not write a pending profile after unmount", async () => {
    const load = deferred<AthleteProfile | null>();
    mockGetSession.mockResolvedValue({
      data: { session: session(firstProfile.email) },
      error: null,
    });
    getProfile.mockReturnValue(load.promise);

    const screen = render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getProfile).toHaveBeenCalledWith(firstProfile.email);
    });

    screen.unmount();
    load.resolve(firstProfile);
    await load.promise;

    expect(profileStorage.get()).toBeNull();
  });
});
