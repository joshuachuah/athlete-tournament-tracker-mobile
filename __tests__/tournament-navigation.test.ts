import { router } from "expo-router";
import type { ReactNode } from "react";

import { returnToDashboard } from "@/app/_layout";
import { leaveTournamentProjection } from "@/app/tournaments/new/_layout";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(),
    dismissTo: jest.fn(),
  },
  Stack: Object.assign(() => null, { Screen: () => null }),
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
