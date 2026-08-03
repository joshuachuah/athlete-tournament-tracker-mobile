import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import IntroductionScreen from "@/app/index";
import { returnToIntroduction } from "@/app/login";

const mockAuthState: {
  profile: object | null;
  session: object | null;
  status: "loading" | "ready";
} = {
  profile: null,
  session: null,
  status: "ready",
};

jest.mock("@/context/auth", () => ({
  useAuth: () => mockAuthState,
}));

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
    mockAuthState.session = null;
    mockAuthState.status = "ready";
  });

  it("introduces the product and opens the combined account page", () => {
    const screen = render(<IntroductionScreen />);

    expect(screen.getByText(/Your season/)).toBeTruthy();
    expect(screen.getByText("Log in or create your free account")).toBeTruthy();

    fireEvent.press(screen.getByText("Get started"));

    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("returns directly-opened account pages to the introduction", () => {
    returnToIntroduction();

    expect(router.replace).toHaveBeenCalledWith("/");
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
