import { useEffect, useRef } from "react";
import { AppState } from "react-native";

const PERSIST_DELAY_MS = 400;

/**
 * Persists a draft after edits settle, then flushes pending work when the app
 * leaves the foreground or the owner unmounts.
 */
export function usePersistedDraft<T>(
  value: T,
  save: (value: T) => void,
  scope?: unknown,
): () => void {
  const latestValue = useRef(value);
  const latestSave = useRef(save);
  const dirty = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPending = useRef<() => void>(() => undefined);

  useEffect(() => {
    latestSave.current = save;
    flushPending.current = () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }

      if (dirty.current) {
        latestSave.current(latestValue.current);
        dirty.current = false;
      }
    };
  }, [save]);

  useEffect(() => {
    latestValue.current = value;
    dirty.current = true;
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(
      () => flushPending.current(),
      PERSIST_DELAY_MS,
    );

    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }
    };
  }, [scope, value]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        flushPending.current();
      }
    });

    return () => {
      subscription.remove();
      flushPending.current();
    };
  }, []);

  return () => flushPending.current();
}
