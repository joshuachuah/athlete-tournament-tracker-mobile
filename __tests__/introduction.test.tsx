import { fireEvent, render, within } from "@testing-library/react-native";
import { router } from "expo-router";
import IntroductionScreen from "@/app/index";
import LoginScreen from "@/app/login";

const mockAppleAvailability = jest.fn();

const mockAuthState: {
  authError: string | null;
  profile: object | null;
  profileLoadError: string | null;
  refreshProfile: jest.Mock<Promise<void>, []>;
  session: object | null;
  signOut: jest.Mock<Promise<void>, []>;
  status: "loading" | "ready";
} = {
  authError: null,
  profile: null,
  profileLoadError: null,
  refreshProfile: jest.fn().mockResolvedValue(undefined),
  session: null,
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

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, null, href),
    router: {
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
    fireEvent.press(screen.getByLabelText("Back to introduction"));

    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("keeps both sign-in providers and errors inside scrollable content", async () => {
    mockAuthState.authError = "Sign-in failed. Try again.";
    mockAppleAvailability.mockResolvedValue(true);

    const screen = render(<LoginScreen />);
    const scrollContent = within(screen.getByTestId("login-scroll-view"));

    expect(
      await scrollContent.findByLabelText("Continue with Apple"),
    ).toBeTruthy();
    expect(scrollContent.getByLabelText("Continue with Google")).toBeTruthy();
    expect(scrollContent.getByText("Sign-in failed. Try again.")).toBeTruthy();
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

    expect(screen.getByText("Loading Athlete Tracker")).toBeTruthy();
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
