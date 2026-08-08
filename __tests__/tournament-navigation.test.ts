import { render } from "@testing-library/react-native";
import { router } from "expo-router";
import { createElement, type ReactNode } from "react";

import RootLayout, { returnToDashboard } from "@/app/_layout";
import { leaveTournamentProjection } from "@/app/tournaments/new/_layout";

let mockPathname = "/";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(),
    dismissTo: jest.fn(),
  },
  Stack: Object.assign(() => null, { Screen: () => null }),
  usePathname: () => mockPathname,
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: ({ style }: { style: string }) => {
    const React = jest.requireActual("react");
    const { Text } = jest.requireActual("react-native");

    return React.createElement(Text, { testID: "root-status-bar" }, style);
  },
}));

jest.mock("@/components/auth/protected-screen", () => ({
  ProtectedScreen: ({ children }: { children: ReactNode }) => children,
}));

jest.mock("@/context/auth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ session: { user: { id: "account-1" } } }),
}));

jest.mock("@/context/tournament-draft", () => ({
  TournamentDraftProvider: ({ children }: { children: ReactNode }) => children,
}));

const mockCanGoBack = router.canGoBack as jest.MockedFunction<
  typeof router.canGoBack
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/";
});

it("uses light system icons when login is the initial route", () => {
  mockPathname = "/login";

  const screen = render(createElement(RootLayout));

  expect(screen.getByTestId("root-status-bar").props.children).toBe("light");
});

it("uses dark system icons for light-background routes", () => {
  const screen = render(createElement(RootLayout));

  expect(screen.getByTestId("root-status-bar").props.children).toBe("dark");
});

it("returns tournament details to the dashboard deterministically", () => {
  returnToDashboard();

  expect(router.dismissTo).toHaveBeenCalledWith("/(tabs)/dashboard");
});

it("uses native history when leaving a projection with history", () => {
  mockCanGoBack.mockReturnValue(true);

  leaveTournamentProjection();

  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.dismissTo).not.toHaveBeenCalled();
});

it("falls back to the Add tab when projection history is unavailable", () => {
  mockCanGoBack.mockReturnValue(false);

  leaveTournamentProjection();

  expect(router.back).not.toHaveBeenCalled();
  expect(router.dismissTo).toHaveBeenCalledWith("/(tabs)/add");
});
