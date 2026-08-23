import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { Session } from "@supabase/supabase-js";
import { router } from "expo-router";
import { Alert, Linking } from "react-native";

import AccountScreen from "@/app/(tabs)/account";
import AccountControlsScreen from "@/app/account-controls";
import { useAuth } from "@/context/auth";
import type { AthleteProfile } from "@/types";

jest.mock("expo-router", () => ({
  Redirect: () => null,
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock("@/context/auth", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const profile: AthleteProfile = {
  id: "athlete-1",
  email: "alex@example.com",
  name: "Alex Morgan",
  home_country: "Malaysia",
  home_currency: "MYR",
  sport: "Squash",
  monthly_income: 8_500,
  savings_balance: 32_400,
  monthly_sponsorship: 1_200,
  created_at: "2026-01-01",
};
const session = {
  access_token: "access-token",
  expires_in: 3_600,
  refresh_token: "refresh-token",
  token_type: "bearer",
  user: {
    app_metadata: { provider: "email" },
    aud: "authenticated",
    created_at: "2026-01-01",
    email: "signed-in@example.com",
    id: "user-1",
    user_metadata: {},
  },
} satisfies Session;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("Account deletion", () => {
  const deleteAccount = jest.fn<Promise<void>, []>();
  const signOut = jest.fn<Promise<void>, []>();
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation();
    deleteAccount.mockResolvedValue();
    signOut.mockResolvedValue();
    mockUseAuth.mockReturnValue({
      profile,
      session,
      status: "ready",
      authError: null,
      profileLoadError: null,
      isCurrentUser: jest.fn(() => true),
      requestEmailCode: jest.fn(),
      refreshProfile: jest.fn(),
      saveProfile: jest.fn(),
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
      deleteAccount,
      signOut,
      verifyEmailCode: jest.fn(),
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  function openConfirmation(screen: ReturnType<typeof render>) {
    fireEvent.press(screen.getByLabelText("Delete account"));
    fireEvent.press(screen.getByText("Continue"));
  }

  it("shows the deletion scope and lets the user cancel before confirmation", () => {
    const screen = render(<AccountControlsScreen />);

    fireEvent.press(screen.getByLabelText("Delete account"));

    expect(screen.getByText("Delete your account?")).toBeTruthy();
    expect(
      screen.getByText("• Your athlete profile and private financial values"),
    ).toBeTruthy();
    expect(
      screen.getByText("• Every saved tournament and projection"),
    ).toBeTruthy();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();

    fireEvent.press(screen.getByText("Cancel"));

    expect(screen.queryByTestId("account-deletion-dialog")).toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("links to public privacy and deletion information", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const screen = render(<AccountScreen />);

    fireEvent.press(screen.getByText("Privacy policy"));
    fireEvent.press(screen.getByText("Account deletion information"));

    expect(openURL).toHaveBeenNthCalledWith(1, "http://localhost:5000/privacy");
    expect(openURL).toHaveBeenNthCalledWith(
      2,
      "http://localhost:5000/account-deletion",
    );
    openURL.mockRestore();
  });

  it("requires the exact confirmation phrase before deletion", async () => {
    const screen = render(<AccountControlsScreen />);
    openConfirmation(screen);

    fireEvent.changeText(
      screen.getByLabelText("Type DELETE to confirm account deletion"),
      "delete",
    );
    fireEvent.press(screen.getByText("Delete permanently"));

    expect(deleteAccount).not.toHaveBeenCalled();

    fireEvent.changeText(
      screen.getByLabelText("Type DELETE to confirm account deletion"),
      "DELETE",
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Delete permanently"));
    });

    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("locks the confirmation controls while deletion is pending", async () => {
    const deletion = deferred<void>();
    deleteAccount.mockReturnValue(deletion.promise);
    const screen = render(<AccountControlsScreen />);
    openConfirmation(screen);
    fireEvent.changeText(
      screen.getByLabelText("Type DELETE to confirm account deletion"),
      "DELETE",
    );

    fireEvent.press(screen.getByText("Delete permanently"));

    expect(screen.getByText("Deleting…")).toBeTruthy();
    expect(
      screen.getByLabelText("Type DELETE to confirm account deletion").props
        .editable,
    ).toBe(false);

    await act(async () => {
      deletion.resolve();
      await deletion.promise;
    });

    expect(screen.queryByTestId("account-deletion-dialog")).toBeNull();
  });

  it("keeps the confirmation open with a retryable error", async () => {
    deleteAccount.mockRejectedValue(new Error("Deletion service unavailable"));
    const screen = render(<AccountControlsScreen />);
    openConfirmation(screen);
    fireEvent.changeText(
      screen.getByLabelText("Type DELETE to confirm account deletion"),
      "DELETE",
    );

    fireEvent.press(screen.getByText("Delete permanently"));

    expect(
      await screen.findByText("Deletion service unavailable"),
    ).toBeTruthy();
    expect(screen.getByTestId("account-deletion-dialog")).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getByLabelText("Type DELETE to confirm account deletion").props
          .editable,
      ).toBe(true);
    });
  });

  it("asks for confirmation before signing out and cancels safely", () => {
    const screen = render(<AccountControlsScreen />);

    fireEvent.press(screen.getByLabelText("Sign out"));

    expect(signOut).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Sign out?",
      "You can sign back in with the same account.",
      expect.any(Array),
    );

    const actions = alertSpy.mock.calls.at(-1)?.[2];
    act(() => {
      actions?.[0]?.onPress?.();
    });

    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out once after confirmation and replaces the route", async () => {
    const screen = render(<AccountControlsScreen />);
    fireEvent.press(screen.getByLabelText("Sign out"));
    const actions = alertSpy.mock.calls.at(-1)?.[2];

    await act(async () => {
      await actions?.[1]?.onPress?.();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/login");
  });

  it("blocks repeated sign-out confirmation while the request is pending", async () => {
    const pendingSignOut = deferred<void>();
    signOut.mockReturnValue(pendingSignOut.promise);
    const screen = render(<AccountControlsScreen />);
    fireEvent.press(screen.getByLabelText("Sign out"));
    const confirm = alertSpy.mock.calls.at(-1)?.[2]?.[1]?.onPress;

    act(() => {
      void confirm?.();
      void confirm?.();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Sign out").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(
      screen.getByLabelText("Delete account").props.accessibilityState,
    ).toEqual({ disabled: true });

    fireEvent.press(screen.getByLabelText("Delete account"));

    expect(screen.queryByTestId("account-deletion-dialog")).toBeNull();

    await act(async () => {
      pendingSignOut.resolve();
      await pendingSignOut.promise;
    });
  });

  it("keeps sign out retryable after an error", async () => {
    signOut
      .mockRejectedValueOnce(new Error("Sign out unavailable"))
      .mockResolvedValueOnce();
    const screen = render(<AccountControlsScreen />);

    fireEvent.press(screen.getByLabelText("Sign out"));
    await act(async () => {
      await alertSpy.mock.calls.at(-1)?.[2]?.[1]?.onPress?.();
    });

    expect(await screen.findByText("Sign out unavailable")).toBeTruthy();
    expect(screen.getByLabelText("Sign out").props.accessibilityState).toEqual({
      disabled: false,
    });

    fireEvent.press(screen.getByLabelText("Sign out"));
    await act(async () => {
      await alertSpy.mock.calls.at(-1)?.[2]?.[1]?.onPress?.();
    });

    expect(signOut).toHaveBeenCalledTimes(2);
    expect(router.replace).toHaveBeenCalledWith("/login");
  });
});
