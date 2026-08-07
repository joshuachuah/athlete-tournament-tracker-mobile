import {
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import { router } from "expo-router";

import OnboardingScreen from "@/app/onboarding";
import { getOnboardingDraft } from "@/lib/onboarding";

const mockDeleteAccount = jest.fn();
const mockSaveProfile = jest.fn();
const mockSignOut = jest.fn();
const mockSession = {
  access_token: "token",
  user: {
    id: "new-athlete",
    email: "athlete@example.com",
    user_metadata: { full_name: "Taylor Kim" },
  },
};

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

jest.mock("@/context/auth", () => ({
  useAuth: () => ({
    deleteAccount: mockDeleteAccount,
    saveProfile: mockSaveProfile,
    session: mockSession,
    signOut: mockSignOut,
  }),
}));

jest.mock("@/components/auth/protected-screen", () => ({
  ProtectedScreen: ({ children }: { children: ReactNode }) => children,
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
  },
}));

describe("profileless onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockDeleteAccount.mockResolvedValue(undefined);
    mockSaveProfile.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
  });

  it("completes the approved setup flow and saves only from review", async () => {
    const screen = render(<OnboardingScreen />);

    expect(screen.getByText("Let’s start with you")).toBeTruthy();
    expect(screen.getByDisplayValue("Taylor Kim")).toBeTruthy();
    expect(screen.getByText("athlete@example.com")).toBeTruthy();

    fireEvent.press(screen.getByText("Continue"));
    expect(screen.getByText("Where is home?")).toBeTruthy();
    expect(mockSaveProfile).not.toHaveBeenCalled();

    fireEvent.press(
      screen.getByLabelText("Home country. Choose a country"),
    );
    fireEvent.press(screen.getByText("Singapore"));

    expect(screen.getByText("Singapore")).toBeTruthy();
    expect(screen.getByText("SGD — Singapore Dollar")).toBeTruthy();

    fireEvent.press(screen.getByText("Continue"));
    expect(screen.getByText("What do you compete in?")).toBeTruthy();

    fireEvent.press(screen.getByText("Tennis"));
    fireEvent.press(screen.getByText("Review profile"));

    expect(screen.getByText("You’re ready, Taylor")).toBeTruthy();
    expect(screen.getByText("SGD")).toBeTruthy();
    fireEvent.press(screen.getByText("Finish setup"));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        name: "Taylor Kim",
        home_country: "Singapore",
        home_currency: "SGD",
        sport: "Tennis",
        monthly_income: 0,
        savings_balance: 0,
        monthly_sponsorship: 0,
      });
      expect(router.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });
    expect(getOnboardingDraft("new-athlete")).toBeNull();
  });

  it("resumes the saved setup step for the same authenticated user", () => {
    const firstRender = render(<OnboardingScreen />);

    fireEvent.press(firstRender.getByText("Continue"));
    expect(firstRender.getByText("Where is home?")).toBeTruthy();
    firstRender.unmount();

    const resumed = render(<OnboardingScreen />);

    expect(resumed.getByText("Where is home?")).toBeTruthy();
    expect(resumed.getByText("2 of 4")).toBeTruthy();
  });

  it("lets a newly authenticated user delete without creating a profile", async () => {
    const screen = render(<OnboardingScreen />);

    fireEvent.press(screen.getByText("Delete this account"));
    const dialog = within(screen.getByTestId("account-deletion-dialog"));
    fireEvent.press(dialog.getByText("Continue"));
    fireEvent.changeText(
      dialog.getByLabelText("Type DELETE to confirm account deletion"),
      "DELETE",
    );
    fireEvent.press(dialog.getByText("Delete permanently"));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(getOnboardingDraft("new-athlete")).toBeNull();
  });

  it("lets a newly authenticated user sign out without creating a profile", async () => {
    const screen = render(<OnboardingScreen />);

    fireEvent.press(screen.getByText("Not your account? Sign out"));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith("/login");
    });
    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(getOnboardingDraft("new-athlete")).toBeNull();
  });
});
