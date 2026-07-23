import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";

import AccountScreen from "@/app/(tabs)/account";
import ProfileScreen from "@/app/(tabs)/profile";
import PrivateFinancesScreen from "@/app/private-finances";
import { useAuth } from "@/context/auth";
import { authenticatePrivateFinances } from "@/lib/private-finance-auth";
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

jest.mock("@/lib/private-finance-auth", () => ({
  authenticatePrivateFinances: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockAuthenticate = authenticatePrivateFinances as jest.MockedFunction<
  typeof authenticatePrivateFinances
>;

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
      refreshProfile: jest.fn(),
      saveProfile: jest.fn(),
      signInWithGoogle: jest.fn(),
      signOut: jest.fn(),
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

  it("stays locked when authentication is cancelled", async () => {
    mockAuthenticate.mockResolvedValue({ success: false, message: null });

    const screen = render(<PrivateFinancesScreen />);

    expect(await screen.findByText("Private finances locked")).toBeTruthy();
    expect(screen.queryByText("Monthly income")).toBeNull();
    expect(screen.queryByText("Savings balance")).toBeNull();
    expect(screen.queryByText("Monthly sponsorship")).toBeNull();
    expect(screen.getByText(/Unlock with/)).toBeTruthy();
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
