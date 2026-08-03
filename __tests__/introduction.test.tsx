import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import IntroductionScreen from "@/app/index";
import LoginScreen from "@/app/login";

const mockAppleAvailability = jest.fn();

const mockAuthState: {
  authError: string | null;
  profile: object | null;
  session: object | null;
  status: "loading" | "ready";
} = {
  authError: null,
  profile: null,
  session: null,
  status: "ready",
};

jest.mock("@/context/auth", () => ({
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

    expect(await screen.findByLabelText("Continue with Apple")).toBeTruthy();
    expect(screen.getByLabelText("Continue with Google")).toBeTruthy();
    expect(screen.getByText("Sign-in failed. Try again.")).toBeTruthy();
    expect(screen.getByTestId("login-scroll-view")).toBeTruthy();
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
});
