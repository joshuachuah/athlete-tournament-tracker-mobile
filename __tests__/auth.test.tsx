import { createRef, useImperativeHandle, type RefObject } from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { AuthProvider, useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
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
  "refreshProfile" | "saveProfile" | "signOut"
>;

function AuthState({ authRef }: { authRef: RefObject<AuthProbe | null> }) {
  const auth = useAuth();
  useImperativeHandle(authRef, () => ({
    refreshProfile: auth.refreshProfile,
    saveProfile: auth.saveProfile,
    signOut: auth.signOut,
  }));

  return (
    <View>
      <Text testID="session-email">{auth.session?.user.email ?? "none"}</Text>
      <Text testID="session-user-id">{auth.session?.user.id ?? "none"}</Text>
      <Text testID="profile-email">{auth.profile?.email ?? "none"}</Text>
      <Text testID="profile-name">{auth.profile?.name ?? "none"}</Text>
      <Text testID="status">{auth.status}</Text>
      <Text testID="auth-error">{auth.authError ?? "none"}</Text>
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

describe("AuthProvider profile isolation", () => {
  const firstProfile = profile("athlete-1", "first@example.com");
  const secondProfile = profile("athlete-2", "second@example.com");
  const firstUserId = "auth-user-1";
  const secondUserId = "auth-user-2";
  const getProfile = api.profile.get as jest.MockedFunction<typeof api.profile.get>;
  const saveProfile = api.profile.save as jest.MockedFunction<
    typeof api.profile.save
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
    const fxKey = ["fx", "MYR", "USD", 100];
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["fx"] });
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
    const fxKey = ["fx", "MYR", "USD", 100];
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
