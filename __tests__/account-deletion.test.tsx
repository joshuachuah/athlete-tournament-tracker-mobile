import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import AccountScreen from "@/app/(tabs)/account";
import { useAuth } from "@/context/auth";
import type { AthleteProfile } from "@/types";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("Account deletion", () => {
  const deleteAccount = jest.fn<Promise<void>, []>();

  beforeEach(() => {
    jest.clearAllMocks();
    deleteAccount.mockResolvedValue();
    mockUseAuth.mockReturnValue({
      profile,
      session: {} as ReturnType<typeof useAuth>["session"],
      status: "ready",
      authError: null,
      isCurrentUser: jest.fn(() => true),
      refreshProfile: jest.fn(),
      saveProfile: jest.fn(),
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
      deleteAccount,
      signOut: jest.fn(),
    });
  });

  function openConfirmation(screen: ReturnType<typeof render>) {
    fireEvent.press(screen.getByLabelText("Delete account"));
    fireEvent.press(screen.getByText("Continue"));
  }

  it("shows the deletion scope and lets the user cancel before confirmation", () => {
    const screen = render(<AccountScreen />);

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
    const screen = render(<AccountScreen />);
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
    const screen = render(<AccountScreen />);
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
    const screen = render(<AccountScreen />);
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
});
