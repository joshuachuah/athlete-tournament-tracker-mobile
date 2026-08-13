import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { usePreventRemove } from "@react-navigation/native";
import { router } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";

import AccountScreen from "@/app/(tabs)/account";
import ProfileScreen from "@/app/(tabs)/profile";
import EditProfileScreen from "@/app/edit-profile";
import PrivateFinancesScreen from "@/app/private-finances";
import { ProfileForm } from "@/components/profile-form";
import { useAuth } from "@/context/auth";
import { authenticatePrivateFinances } from "@/lib/private-finance-auth";
import type { AthleteProfile } from "@/types";

jest.mock("expo-router", () => ({
  Redirect: () => null,
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock("@react-navigation/native", () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock("@/context/auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/private-finance-auth", () => ({
  authenticatePrivateFinances: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUsePreventRemove = usePreventRemove as jest.MockedFunction<
  typeof usePreventRemove
>;
const mockAuthenticate = authenticatePrivateFinances as jest.MockedFunction<
  typeof authenticatePrivateFinances
>;
const mockSaveProfile = jest.fn();

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

describe("split profile destinations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      profile,
      session: {} as ReturnType<typeof useAuth>["session"],
      status: "ready",
      authError: null,
      profileLoadError: null,
      isCurrentUser: jest.fn(() => true),
      requestEmailCode: jest.fn(),
      refreshProfile: jest.fn(),
      saveProfile: mockSaveProfile,
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
      deleteAccount: jest.fn(),
      signOut: jest.fn(),
      verifyEmailCode: jest.fn(),
    });
  });

  it("keeps the profile destination focused on athlete identity", () => {
    const screen = render(<ProfileScreen />);

    expect(screen.getByText(profile.name)).toBeTruthy();
    expect(screen.getByText(profile.home_country)).toBeTruthy();
    expect(screen.getByText(profile.sport)).toBeTruthy();
    expect(screen.queryByText("Monthly income")).toBeNull();
    expect(screen.queryByText("Savings balance")).toBeNull();
    expect(screen.queryByText("Monthly sponsorship")).toBeNull();

    fireEvent.press(screen.getByText("Edit profile"));

    expect(router.push).toHaveBeenCalledWith("/edit-profile");
  });

  it("updates identity fields without rendering private finances", async () => {
    mockSaveProfile.mockResolvedValue({
      ...profile,
      name: "Alexandra Morgan",
      home_currency: "USD",
    });
    const screen = render(<EditProfileScreen />);

    expect(screen.queryByText("Monthly income")).toBeNull();
    expect(screen.queryByText("Savings")).toBeNull();
    expect(screen.queryByText("Monthly sponsorship")).toBeNull();

    fireEvent.changeText(screen.getByLabelText("Name"), "Alexandra Morgan");
    fireEvent.changeText(screen.getByLabelText("Home currency"), "usd");
    fireEvent.press(screen.getByText("Save profile"));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        name: "Alexandra Morgan",
        home_country: profile.home_country,
        home_currency: "USD",
        sport: profile.sport,
        monthly_income: profile.monthly_income,
        savings_balance: profile.savings_balance,
        monthly_sponsorship: profile.monthly_sponsorship,
      });
      expect(router.back).toHaveBeenCalled();
    });
  });

  it("renders one quiet locked row without financial values on Account", () => {
    const screen = render(<AccountScreen />);

    expect(screen.getByText(profile.email)).toBeTruthy();
    expect(screen.getByText(profile.home_currency)).toBeTruthy();
    expect(screen.getByText("Private finances")).toBeTruthy();
    expect(screen.getByText("Locked")).toBeTruthy();
    expect(screen.queryByText("Monthly income")).toBeNull();
    expect(screen.queryByText("Savings balance")).toBeNull();
    expect(screen.queryByText("Monthly sponsorship")).toBeNull();
    expect(screen.queryByText(/8,500/)).toBeNull();
    expect(screen.queryByText(/32,400/)).toBeNull();
    expect(screen.queryByText(/1,200/)).toBeNull();

    fireEvent.press(
      screen.getByLabelText(
        "Private finances, device authentication required, locked",
      ),
    );

    expect(router.push).toHaveBeenCalledWith("/private-finances");
  });

  it("does not mount financial values until authentication succeeds", async () => {
    let resolveAuthentication:
      | ((result: { success: true }) => void)
      | undefined;
    mockAuthenticate.mockReturnValue(
      new Promise((resolve) => {
        resolveAuthentication = resolve;
      }),
    );

    const screen = render(<PrivateFinancesScreen />);

    expect(screen.getByText("Authenticating…")).toBeTruthy();
    expect(screen.queryByText("Monthly income")).toBeNull();
    expect(screen.queryByText("Savings balance")).toBeNull();
    expect(screen.queryByText("Monthly sponsorship")).toBeNull();

    await act(async () => {
      resolveAuthentication?.({ success: true });
    });

    expect(await screen.findByText("Monthly income")).toBeTruthy();
    expect(screen.getByText("Savings balance")).toBeTruthy();
    expect(screen.getByText("Monthly sponsorship")).toBeTruthy();
    expect(screen.getByText(/8,500/)).toBeTruthy();
    expect(screen.getByText(/32,400/)).toBeTruthy();
    expect(screen.getByText(/1,200/)).toBeTruthy();

    fireEvent.press(screen.getByText("Lock private finances"));

    await waitFor(() => {
      expect(screen.queryByText("Monthly income")).toBeNull();
      expect(screen.getByText("Private finances locked")).toBeTruthy();
    });
  });

  it("edits financial values only after biometric authentication", async () => {
    mockAuthenticate.mockResolvedValue({ success: true });
    mockSaveProfile.mockResolvedValue({
      ...profile,
      monthly_income: 9_000,
      savings_balance: 40_000,
      monthly_sponsorship: 1_500,
    });
    const screen = render(<PrivateFinancesScreen />);

    await screen.findByText("Edit private finances");
    fireEvent.press(screen.getByText("Edit private finances"));

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByLabelText("Home country")).toBeNull();
    expect(screen.queryByLabelText("Home currency")).toBeNull();
    expect(screen.queryByLabelText("Sport")).toBeNull();

    fireEvent.changeText(screen.getByLabelText("Monthly income"), "9000");
    fireEvent.changeText(screen.getByLabelText("Savings"), "40000");
    fireEvent.changeText(screen.getByLabelText("Monthly sponsorship"), "1500");
    fireEvent.press(screen.getByText("Save private finances"));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        name: profile.name,
        home_country: profile.home_country,
        home_currency: profile.home_currency,
        sport: profile.sport,
        monthly_income: 9_000,
        savings_balance: 40_000,
        monthly_sponsorship: 1_500,
      });
      expect(screen.getByText("Private finances updated.")).toBeTruthy();
      expect(screen.queryByText("Save private finances")).toBeNull();
    });
  });

  it("refreshes hidden fields without replacing visible identity edits", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const screen = render(
      <ProfileForm
        fields="identity"
        profile={profile}
        submitLabel="Save"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Name"), "Alexandra Morgan");
    const latestProfile = {
      ...profile,
      monthly_income: 9_250,
      savings_balance: 41_000,
      monthly_sponsorship: 1_800,
    };
    screen.rerender(
      <ProfileForm
        fields="identity"
        profile={latestProfile}
        submitLabel="Save"
        onSubmit={onSubmit}
      />,
    );
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          name: "Alexandra Morgan",
          monthly_income: latestProfile.monthly_income,
          savings_balance: latestProfile.savings_balance,
          monthly_sponsorship: latestProfile.monthly_sponsorship,
        }),
      );
    });
  });

  it("refreshes hidden identity without replacing visible financial edits", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const screen = render(
      <ProfileForm
        fields="finances"
        profile={profile}
        submitLabel="Save"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.changeText(screen.getByLabelText("Monthly income"), "9000");
    const latestProfile = {
      ...profile,
      name: "Alexandra Morgan",
      home_country: "Singapore",
      sport: "Tennis",
    };
    screen.rerender(
      <ProfileForm
        fields="finances"
        profile={latestProfile}
        submitLabel="Save"
        onSubmit={onSubmit}
      />,
    );
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(onSubmit.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          name: latestProfile.name,
          home_country: latestProfile.home_country,
          sport: latestProfile.sport,
          monthly_income: 9_000,
        }),
      );
    });
  });

  it("blocks a second financial edit until a locked save settles", async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    const appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
    let resolveSave: ((savedProfile: AthleteProfile) => void) | undefined;
    mockAuthenticate.mockResolvedValue({ success: true });
    mockSaveProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const screen = render(<PrivateFinancesScreen />);

    await screen.findByText("Edit private finances");
    fireEvent.press(screen.getByText("Edit private finances"));
    fireEvent.press(screen.getByText("Save private finances"));
    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledTimes(1);
      expect(mockUsePreventRemove).toHaveBeenLastCalledWith(
        true,
        expect.any(Function),
      );
    });

    act(() => {
      appStateListener?.("background");
      appStateListener?.("active");
    });
    fireEvent.press(await screen.findByText(/Unlock with/));
    const editButton = await screen.findByRole("button", {
      name: "Edit private finances",
    });
    expect(editButton.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(editButton);
    expect(screen.queryByText("Save private finances")).toBeNull();

    await act(async () => {
      resolveSave?.(profile);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Edit private finances",
        }).props.accessibilityState,
      ).toEqual({ disabled: false });
    });
    fireEvent.press(
      screen.getByRole("button", {
        name: "Edit private finances",
      }),
    );
    expect(screen.getByText("Save private finances")).toBeTruthy();
    expect(screen.queryByText("Private finances updated.")).toBeNull();
    appStateSpy.mockRestore();
  });

  it("keeps the financial editor open when saving fails", async () => {
    mockAuthenticate.mockResolvedValue({ success: true });
    mockSaveProfile.mockRejectedValue(new Error("Profile update failed"));
    const screen = render(<PrivateFinancesScreen />);

    await screen.findByText("Edit private finances");
    fireEvent.press(screen.getByText("Edit private finances"));
    fireEvent.press(screen.getByText("Save private finances"));

    expect(await screen.findByText("Profile update failed")).toBeTruthy();
    expect(screen.getByText("Save private finances")).toBeTruthy();
  });

  it("stays locked when authentication is cancelled", async () => {
    mockAuthenticate.mockResolvedValue({ success: false, message: null });

    const screen = render(<PrivateFinancesScreen />);

    expect(await screen.findByText("Private finances locked")).toBeTruthy();
    expect(screen.queryByText("Monthly income")).toBeNull();
    expect(screen.queryByText("Savings balance")).toBeNull();
    expect(screen.queryByText("Monthly sponsorship")).toBeNull();
    expect(screen.getByText(/Unlock with/)).toBeTruthy();
  });

  it("allows Face ID authentication through iOS inactive transitions", async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    const appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
    let resolveAuthentication:
      | ((result: { success: true }) => void)
      | undefined;
    mockAuthenticate.mockReturnValue(
      new Promise((resolve) => {
        resolveAuthentication = resolve;
      }),
    );

    const screen = render(<PrivateFinancesScreen />);

    act(() => {
      appStateListener?.("inactive");
    });
    await act(async () => {
      resolveAuthentication?.({ success: true });
    });

    expect(screen.getByText("Authenticating…")).toBeTruthy();
    expect(screen.queryByText("Monthly income")).toBeNull();

    act(() => {
      appStateListener?.("active");
    });

    expect(await screen.findByText("Monthly income")).toBeTruthy();
    expect(screen.getByText("Face ID verified")).toBeTruthy();
    appStateSpy.mockRestore();
  });

  it("locks visible finances when an unlocked app becomes inactive", async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    const appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
    mockAuthenticate.mockResolvedValue({ success: true });

    const screen = render(<PrivateFinancesScreen />);
    expect(await screen.findByText("Monthly income")).toBeTruthy();

    act(() => {
      appStateListener?.("inactive");
    });

    expect(await screen.findByText("Private finances locked")).toBeTruthy();
    expect(screen.queryByText("Monthly income")).toBeNull();
    appStateSpy.mockRestore();
  });

  it("ignores a pending successful authentication after the app backgrounds", async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    const appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
    let resolveAuthentication:
      | ((result: { success: true }) => void)
      | undefined;
    mockAuthenticate.mockReturnValue(
      new Promise((resolve) => {
        resolveAuthentication = resolve;
      }),
    );

    const screen = render(<PrivateFinancesScreen />);

    act(() => {
      appStateListener?.("background");
    });
    await act(async () => {
      resolveAuthentication?.({ success: true });
    });

    expect(screen.getByText("Private finances locked")).toBeTruthy();
    expect(screen.queryByText("Monthly income")).toBeNull();
    appStateSpy.mockRestore();
  });
});
