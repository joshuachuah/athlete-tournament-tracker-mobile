import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { ProtectedScreen } from "@/components/auth/protected-screen";

const mockUseAuth = jest.fn();

jest.mock("@/context/auth", () => ({
  PROFILE_LOAD_FALLBACK_MESSAGE:
    "We couldn't load your profile. Check your connection and try again.",
  useAuth: () => mockUseAuth(),
}));

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { Text: NativeText } = jest.requireActual("react-native");

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(NativeText, { testID: "redirect-href" }, href),
  };
});

const protectedQueryRender = jest.fn();

function ProtectedContent({ route }: { route?: string }) {
  protectedQueryRender(route);
  return <Text>{route ?? "Protected content"}</Text>;
}

describe("ProtectedScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    protectedQueryRender.mockReset();
  });

  it("shows bootstrap UI without redirecting or mounting protected content", () => {
    mockUseAuth.mockReturnValue({
      status: "loading",
      session: null,
      profile: null,
      profileLoadError: null,
    });

    const screen = render(
      <ProtectedScreen>
        <ProtectedContent />
      </ProtectedScreen>,
    );

    expect(screen.getByText("Loading athlete tracker")).toBeTruthy();
    expect(screen.queryByTestId("redirect-href")).toBeNull();
    expect(protectedQueryRender).not.toHaveBeenCalled();
  });

  it("redirects a signed-out user to login", () => {
    mockUseAuth.mockReturnValue({
      status: "ready",
      session: null,
      profile: null,
      profileLoadError: null,
    });

    const screen = render(
      <ProtectedScreen>
        <ProtectedContent />
      </ProtectedScreen>,
    );

    expect(screen.getByTestId("redirect-href").props.children).toBe("/login");
    expect(protectedQueryRender).not.toHaveBeenCalled();
  });

  it("redirects a signed-in user without a required profile to onboarding", () => {
    mockUseAuth.mockReturnValue({
      status: "ready",
      session: {},
      profile: null,
      profileLoadError: null,
    });

    const screen = render(
      <ProtectedScreen>
        <ProtectedContent />
      </ProtectedScreen>,
    );

    expect(screen.getByTestId("redirect-href").props.children).toBe(
      "/onboarding",
    );
    expect(protectedQueryRender).not.toHaveBeenCalled();
  });

  it("allows onboarding for a signed-in user without a profile", () => {
    mockUseAuth.mockReturnValue({
      status: "ready",
      session: {},
      profile: null,
      profileLoadError: null,
    });

    const screen = render(
      <ProtectedScreen requireProfile={false}>
        <ProtectedContent />
      </ProtectedScreen>,
    );

    expect(screen.getByText("Protected content")).toBeTruthy();
    expect(screen.queryByTestId("redirect-href")).toBeNull();
  });

  it("blocks optional-profile content after a load failure and offers recovery", () => {
    const refreshProfile = jest.fn().mockResolvedValue(undefined);
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      status: "ready",
      session: {},
      profile: null,
      profileLoadError: "Profile service unavailable.",
      refreshProfile,
      signOut,
    });

    const screen = render(
      <ProtectedScreen requireProfile={false}>
        <ProtectedContent />
      </ProtectedScreen>,
    );

    expect(screen.getByText("Profile service unavailable.")).toBeTruthy();
    expect(screen.queryByTestId("redirect-href")).toBeNull();
    expect(protectedQueryRender).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Try again"));
    fireEvent.press(screen.getByText("Sign out"));

    expect(refreshProfile).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("mounts protected content for a signed-in user with a profile", () => {
    mockUseAuth.mockReturnValue({
      status: "ready",
      session: {},
      profile: {},
      profileLoadError: null,
    });

    const screen = render(
      <ProtectedScreen>
        <ProtectedContent />
      </ProtectedScreen>,
    );

    expect(screen.getByText("Protected content")).toBeTruthy();
    expect(screen.queryByTestId("redirect-href")).toBeNull();
  });

  it.each([
    "/tournaments/tournament-1",
    "/tournaments/new/details?editId=tournament-1",
  ])(
    "preserves an authenticated cold-start %s route until auth is ready",
    (route) => {
      mockUseAuth.mockReturnValue({
        status: "loading",
        session: null,
        profile: null,
        profileLoadError: null,
      });

      const screen = render(
        <ProtectedScreen>
          <ProtectedContent route={route} />
        </ProtectedScreen>,
      );

      expect(screen.queryByTestId("redirect-href")).toBeNull();
      expect(protectedQueryRender).not.toHaveBeenCalled();

      mockUseAuth.mockReturnValue({
        status: "ready",
        session: {},
        profile: {},
        profileLoadError: null,
      });
      screen.rerender(
        <ProtectedScreen>
          <ProtectedContent route={route} />
        </ProtectedScreen>,
      );

      expect(screen.getByText(route)).toBeTruthy();
      expect(protectedQueryRender).toHaveBeenCalledWith(route);
    },
  );
});
