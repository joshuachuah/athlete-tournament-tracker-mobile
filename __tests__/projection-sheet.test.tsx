import { fireEvent, render } from "@testing-library/react-native";
import { useLayoutEffect, useState, type PropsWithChildren } from "react";
import { Button, Text } from "react-native";

import {
  ProjectionSheet,
  ProjectionSheetProvider,
  ProjectionSheetRoute,
  type ProjectionSheetScreen,
} from "@/components/tournament/projection-sheet";
import { createDefaultTournamentDraft } from "@/lib/tournament-draft";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockNavigation = {
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  goBack: () => mockBack(),
};
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    router: {
      push: (...args: unknown[]) => mockPush(...args),
      back: () => mockBack(),
    },
    Stack: { Screen: () => null },
    Redirect: ({ href }: { href: string }) => <Text>Redirect to {href}</Text>,
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@/hooks/use-tournament-preview", () => ({
  useTournamentPreview: () => ({ data: undefined, isLoadingPreview: false }),
}));

const initialDraft = createDefaultTournamentDraft(new Date(2026, 0, 1));

function Owner({ onDismiss, name = "coaching" }: { onDismiss: () => void; name?: string }) {
  const [screen, setScreen] = useState<ProjectionSheetScreen | null>(null);
  return (
    <ProjectionSheet
      draft={initialDraft}
      screen={screen}
      onApply={() => undefined}
      onSelect={(editor) => setScreen({ kind: "editor", editor })}
      onDismiss={() => {
        setScreen(null);
        onDismiss();
      }}
    >
      <Button
        title={`Open ${name}`}
        onPress={() => setScreen({ kind: "editor", editor: "coaching" })}
      />
    </ProjectionSheet>
  );
}

function Navigator({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    mockPush.mockImplementation(() => setVisible(true));
    mockBack.mockImplementation(() => setVisible(false));
  }, []);
  return (
    <ProjectionSheetProvider>
      {children}
      {visible ? <ProjectionSheetRoute /> : null}
    </ProjectionSheetProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation.isFocused.mockReturnValue(true);
  mockNavigation.canGoBack.mockReturnValue(true);
});

describe("projection sheet ownership", () => {
  it("lets a rejected owner retry after the active owner's sheet closes", () => {
    const firstDismiss = jest.fn();
    const secondDismiss = jest.fn();
    const screen = render(
      <>
        <Owner name="first" onDismiss={firstDismiss} />
        <Owner name="second" onDismiss={secondDismiss} />
      </>,
      { wrapper: Navigator },
    );
    fireEvent.press(screen.getByText("Open first"));
    fireEvent.press(screen.getByText("Open second"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(secondDismiss).toHaveBeenCalledTimes(1);
    expect(firstDismiss).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Cancel"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText("Open second"));
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Coaching / physio (USD)")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    expect(mockBack).toHaveBeenCalledTimes(2);
    expect(secondDismiss).toHaveBeenCalledTimes(2);
  });

  it("does not pop another route after navigation has already moved away", () => {
    const screen = render(<Owner onDismiss={jest.fn()} />, { wrapper: Navigator });
    fireEvent.press(screen.getByText("Open coaching"));
    mockNavigation.isFocused.mockReturnValue(false);
    screen.rerender(<Text>Signed out</Text>);
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Coaching / physio (USD)")).toBeNull();
    expect(screen.queryByText("Redirect to /")).toBeNull();
  });

  it("redirects a direct route visit when no builder owns a session", () => {
    const screen = render(
      <ProjectionSheetProvider>
        <ProjectionSheetRoute />
      </ProjectionSheetProvider>,
    );

    expect(screen.getByText("Redirect to /")).toBeTruthy();
    expect(screen.queryByText("Apply coaching / physio")).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("removes an unmounted owner's editor and lets a fresh owner open cleanly", () => {
    const onDismiss = jest.fn();
    const screen = render(<Owner onDismiss={onDismiss} />, { wrapper: Navigator });

    fireEvent.press(screen.getByText("Open coaching"));
    fireEvent.changeText(screen.getByLabelText("Coaching / physio (USD)"), "123");

    // A keyed builder disappears when its account or create/edit identity changes.
    screen.rerender(<Text>Owner removed</Text>);
    expect(screen.queryByLabelText("Coaching / physio (USD)")).toBeNull();
    expect(screen.queryByText("Redirect to /")).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const nextDismiss = jest.fn();
    screen.rerender(<Owner onDismiss={nextDismiss} />);
    fireEvent.press(screen.getByText("Open coaching"));

    expect(screen.getByLabelText("Coaching / physio (USD)").props.value).toBe("");
    expect(screen.queryByText("Redirect to /")).toBeNull();
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(nextDismiss).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Cancel"));
    expect(mockBack).toHaveBeenCalledTimes(2);
    expect(nextDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
