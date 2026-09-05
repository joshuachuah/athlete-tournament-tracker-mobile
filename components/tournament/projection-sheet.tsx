import { createContext, use, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type PropsWithChildren, type ReactNode } from "react";
import { Keyboard, StyleSheet, View, useWindowDimensions } from "react-native";
import { Redirect, router, Stack } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssumptionPicker } from "@/components/tournament/assumption-picker";
import type { AssumptionEditor, ProjectionEditor } from "@/components/tournament/impact-ledger";
import { ProjectionEditorContent } from "@/components/tournament/projection-editor-sheet";
import { spacing } from "@/constants/theme";

export type ProjectionSheetScreen =
  | { kind: "picker" }
  | { kind: "editor"; editor: ProjectionEditor };

export type ProjectionSheetProps = Omit<ComponentProps<typeof ProjectionEditorContent>, "editor" | "onClose"> & {
  children: ReactNode;
  screen: ProjectionSheetScreen | null;
  onSelect: (editor: AssumptionEditor) => void;
  onDismiss: () => void;
};

type Session = Omit<ProjectionSheetProps, "children" | "screen"> & {
  id: string;
  screen: ProjectionSheetScreen;
};
type SheetContextValue = {
  session: Session | null;
  open: (session: Session) => boolean;
  finish: (id: string) => void;
};
const SheetContext = createContext<SheetContextValue | null>(null);

// Transient sheet data belongs to this mounted app, never to a URL or storage.
export function ProjectionSheetProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const current = useRef<Session | null>(null);

  function open(next: Session) {
    if (current.current) return false;
    current.current = next;
    setSession(next);
    router.push("/projection-sheet");
    return true;
  }

  function finish(id: string) {
    const previous = current.current;
    if (previous?.id !== id) return;
    current.current = null;
    setSession(null);
    previous.onDismiss();
  }

  return <SheetContext value={{ session, open, finish }}>{children}</SheetContext>;
}

function useSheetContext() {
  const context = use(SheetContext);
  if (!context) throw new Error("ProjectionSheetProvider is required");
  return context;
}

// Keep live callbacks with the builder while the native route owns presentation.
export function ProjectionSheet({ children, screen, ...props }: ProjectionSheetProps) {
  const { open, finish } = useSheetContext();
  const id = useId();
  const presented = useRef<string | null>(null);
  const sequence = useRef(0);
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });

  useEffect(() => {
    if (!screen || presented.current) return;
    const sessionId = `${id}:${++sequence.current}`;
    presented.current = sessionId;
    const accepted = open({
      ...latest.current,
      id: sessionId,
      screen,
      onApply: (draft) => latest.current.onApply(draft),
      onSelect: (editor) => latest.current.onSelect(editor),
      onDismiss: () => {
        presented.current = null;
        latest.current.onDismiss();
      },
    });
    if (!accepted) {
      presented.current = null;
      latest.current.onDismiss();
    }
  }, [screen, id, open]);

  useEffect(() => () => {
    if (presented.current) finish(presented.current);
  }, [finish]);
  return children;
}

export function ProjectionSheetRoute() {
  const { session, finish } = useSheetContext();
  const navigation = useNavigation();
  const [ownedSession] = useState(Boolean(session));
  const id = session?.id;
  useEffect(() => () => { if (id) finish(id); }, [finish, id]);
  useEffect(() => {
    // Owner removal ends this modal. A concurrent redirect may already have
    // focused another route, which must not be popped by this cleanup.
    if (!session && ownedSession && navigation.isFocused() && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [session, ownedSession, navigation]);
  if (!session) return ownedSession ? null : <Redirect href="/" />;
  return <SheetContent key={session.id} session={session} />;
}

function SheetContent({ session }: { session: Session }) {
  const [screen, setScreen] = useState(session.screen);
  const closing = useRef(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  function close() {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    router.back();
  }

  return (
    <View collapsable={false} style={[styles.content, { maxHeight: height - insets.top - spacing.xl }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {screen.kind === "picker" ? (
        <AssumptionPicker
          draft={session.draft}
          onClose={close}
          onSelect={(editor) => {
            if (closing.current) return;
            Keyboard.dismiss();
            session.onSelect(editor);
            setScreen({ kind: "editor", editor });
          }}
        />
      ) : (
        <ProjectionEditorContent
          key={screen.editor}
          authenticatedUserId={session.authenticatedUserId}
          draft={session.draft}
          editor={screen.editor}
          homeCurrency={session.homeCurrency}
          profileId={session.profileId}
          onClose={close}
          onApply={(draft) => {
            if (closing.current) return;
            session.onApply(draft);
            close();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ content: { paddingTop: spacing.xl, flexShrink: 1 } });
