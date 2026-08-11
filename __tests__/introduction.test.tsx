import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";
import { router } from "expo-router";
import { Linking } from "react-native";
import IntroductionScreen from "@/app/index";
import LoginScreen from "@/app/login";

const mockAppleAvailability = jest.fn();
const mockImpactAsync = jest.fn();

const mockAuthState: {
  authError: string | null;
  profile: object | null;
  profileLoadError: string | null;
  refreshProfile: jest.Mock<Promise<void>, []>;
  session: object | null;
  signInWithApple: jest.Mock<Promise<void>, []>;
  signInWithGoogle: jest.Mock<Promise<void>, []>;
  signOut: jest.Mock<Promise<void>, []>;
  status: "loading" | "ready";
} = {
  authError: null,
  profile: null,
  profileLoadError: null,
  refreshProfile: jest.fn().mockResolvedValue(undefined),
  session: null,
  signInWithApple: jest.fn().mockResolvedValue(undefined),
  signInWithGoogle: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  status: "ready",
};

jest.mock("@/context/auth", () => ({
  PROFILE_LOAD_FALLBACK_MESSAGE:
    "We couldn't load your profile. Check your connection and try again.",
  useAuth: () => mockAuthState,
}));

jest.mock("expo-apple-authentication", () => {
  const React = jest.requireActual("react");
  const { Pressable } = jest.requireActual("react-native");

  return {
    AppleAuthenticationButton: ({ onPress, style }: Record<string, unknown>) =>
      React.createElement(Pressable, {
        accessibilityLabel: "Continue with Apple",
        onPress,
        style,
      }),
    AppleAuthenticationButtonStyle: { WHITE: "white" },
    AppleAuthenticationButtonType: { CONTINUE: "continue" },
    isAvailableAsync: (...args: unknown[]) => mockAppleAvailability(...args),
  };
});

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Medium: "medium" },
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
}));

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, null, href),
    router: {
      back: jest.fn(),
      canGoBack: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
    },
  };
});

describe("IntroductionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.profile = null;
    mockAuthState.authError = null;
    mockAuthState.profileLoadError = null;
    mockAuthState.session = null;
    mockAuthState.status = "ready";
    mockAppleAvailability.mockResolvedValue(false);
    mockImpactAsync.mockResolvedValue(undefined);
    jest.mocked(router.canGoBack).mockReturnValue(false);
  });

  it("introduces the product and opens the combined account page", () => {
    const screen = render(<IntroductionScreen />);

    expect(screen.getByText(/Your season/)).toBeTruthy();
    expect(screen.getByText("Log in or create your free account")).toBeTruthy();

    fireEvent.press(screen.getByText("Get started"));

    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("returns directly-opened account pages to the introduction", () => {
    const screen = render(<LoginScreen />);

    expect(screen.getByTestId("login-scroll-view")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Close account screen"));

    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("pops account pages opened from the introduction", () => {
    jest.mocked(router.canGoBack).mockReturnValue(true);
    const screen = render(<LoginScreen />);

    fireEvent.press(screen.getByLabelText("Close account screen"));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("keeps the beta sign-in providers and errors inside scrollable content", async () => {
    mockAuthState.authError = "Sign-in failed. Try again.";
    mockAppleAvailability.mockResolvedValue(true);

    const screen = render(<LoginScreen />);
    const scrollContent = within(screen.getByTestId("login-scroll-view"));

    expect(scrollContent.getByText("ATHLETE TRACKER")).toBeTruthy();
    expect(scrollContent.getByText("Your season, in focus.")).toBeTruthy();
    expect(
      await scrollContent.findByLabelText("Continue with Apple"),
    ).toBeTruthy();
    expect(scrollContent.getByLabelText("Continue with Google")).toBeTruthy();
    expect(scrollContent.queryByLabelText("Email address")).toBeNull();
    expect(scrollContent.queryByText("OR USE EMAIL")).toBeNull();
    expect(scrollContent.getByText("Sign-in failed. Try again.")).toBeTruthy();
  });

  it("starts Google sign-in without waiting for haptic feedback", async () => {
    const expoOs = process.env.EXPO_OS;
    process.env.EXPO_OS = "ios";
    mockImpactAsync.mockReturnValue(new Promise(() => undefined));
    const screen = render(<LoginScreen />);

    try {
      await act(async () => {
        fireEvent.press(screen.getByLabelText("Continue with Google"));
        await Promise.resolve();
      });

      expect(mockImpactAsync).toHaveBeenCalledWith("medium");
      expect(mockAuthState.signInWithGoogle).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByText("Continue with Google")).toBeTruthy();
      });
    } finally {
      process.env.EXPO_OS = expoOs;
    }
  });

  it("opens the configured privacy policy from the consent copy", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const screen = render(<LoginScreen />);

    fireEvent.press(screen.getByText("Privacy Policy"));

    expect(openURL).toHaveBeenCalledWith("http://localhost:5000/privacy");
    openURL.mockRestore();
  });

  it("keeps returning athletes on the direct dashboard path", () => {
    mockAuthState.session = { user: { id: "athlete" } };
    mockAuthState.profile = { id: "profile" };

    const screen = render(<IntroductionScreen />);

    expect(screen.getByText("/(tabs)/dashboard")).toBeTruthy();
  });

  it("sends authenticated athletes without a profile to onboarding", () => {
    mockAuthState.session = { user: { id: "new-athlete" } };

    const screen = render(<IntroductionScreen />);

    expect(screen.getByText("/onboarding")).toBeTruthy();
  });

  it("blocks onboarding and retries when the profile load failed", () => {
    mockAuthState.session = { user: { id: "athlete" } };
    mockAuthState.profileLoadError = "Profile service unavailable.";

    const screen = render(<IntroductionScreen />);

    expect(screen.getByText("Profile service unavailable.")).toBeTruthy();
    expect(screen.queryByText("/onboarding")).toBeNull();

    fireEvent.press(screen.getByText("Try again"));

    expect(mockAuthState.refreshProfile).toHaveBeenCalledTimes(1);
  });

  it("treats an empty recorded failure as blocking", () => {
    mockAuthState.session = { user: { id: "athlete" } };
    mockAuthState.profileLoadError = "";

    const screen = render(<IntroductionScreen />);

    expect(
      screen.getByText(
        "We couldn't load your profile. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("/onboarding")).toBeNull();
  });

  it("keeps the authenticated login route off onboarding while loading", () => {
    mockAuthState.session = { user: { id: "athlete" } };
    mockAuthState.status = "loading";

    const screen = render(<LoginScreen />);

    expect(screen.getByText("Loading athlete profile")).toBeTruthy();
    expect(screen.queryByText("/onboarding")).toBeNull();
  });

  it("shows profile recovery on the login route instead of onboarding", () => {
    mockAuthState.session = { user: { id: "athlete" } };
    mockAuthState.profileLoadError = "Profile service unavailable.";

    const screen = render(<LoginScreen />);

    expect(screen.getByText("Profile service unavailable.")).toBeTruthy();
    expect(screen.queryByText("/onboarding")).toBeNull();
  });
});
