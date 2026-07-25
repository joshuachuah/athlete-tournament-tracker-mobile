import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { router } from "expo-router";

import OnboardingScreen from "@/app/onboarding";

const mockDeleteAccount = jest.fn();
const mockSaveProfile = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/context/auth", () => ({
  useAuth: () => ({
    deleteAccount: mockDeleteAccount,
    saveProfile: mockSaveProfile,
    signOut: mockSignOut,
  }),
}));

jest.mock("@/components/auth/protected-screen", () => ({
  ProtectedScreen: ({ children }: { children: ReactNode }) => children,
}));

jest.mock("@/components/profile-form", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");

  return {
    ProfileForm: () => React.createElement(Text, null, "Profile form"),
  };
});

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
  },
}));

describe("profileless account actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteAccount.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
  });

  it("lets a newly authenticated user delete without creating a profile", async () => {
    const screen = render(<OnboardingScreen />);

    fireEvent.press(screen.getByText("Delete this account"));
    fireEvent.press(screen.getByText("Continue"));
    fireEvent.changeText(
      screen.getByLabelText("Type DELETE to confirm account deletion"),
      "DELETE",
    );
    fireEvent.press(screen.getByText("Delete permanently"));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });

  it("lets a newly authenticated user sign out without creating a profile", async () => {
    const screen = render(<OnboardingScreen />);

    fireEvent.press(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith("/login");
    });
    expect(mockSaveProfile).not.toHaveBeenCalled();
  });
});
