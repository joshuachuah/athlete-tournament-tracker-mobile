import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { usePersistedDraft } from "@/hooks/use-persisted-draft";

describe("usePersistedDraft", () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    appStateListener = undefined;
  });

  it("writes once after edits settle", () => {
    const save = jest.fn();
    const hook = renderHook(
      ({ value }: { value: string }) => usePersistedDraft(value, save),
      { initialProps: { value: "a" } },
    );

    act(() => {
      jest.advanceTimersByTime(100);
      hook.rerender({ value: "ab" });
      jest.advanceTimersByTime(100);
      hook.rerender({ value: "abc" });
    });

    expect(save).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(400));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("abc");
  });

  it("flushes the latest value on unmount", () => {
    const save = jest.fn();
    const hook = renderHook(
      ({ value }: { value: string }) => usePersistedDraft(value, save),
      { initialProps: { value: "a" } },
    );

    hook.rerender({ value: "latest" });
    hook.unmount();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("latest");
  });

  it("flushes once when the app backgrounds", () => {
    const save = jest.fn();
    renderHook(() => usePersistedDraft("draft", save));

    act(() => appStateListener?.("background"));
    act(() => jest.advanceTimersByTime(400));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("draft");
  });

  it("does not flush a clean value on unmount", () => {
    const save = jest.fn();
    const hook = renderHook(() => usePersistedDraft("draft", save));

    act(() => jest.advanceTimersByTime(400));
    hook.unmount();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("supports an explicit completion flush without recreating the draft", () => {
    const save = jest.fn();
    const hook = renderHook(() => usePersistedDraft("complete", save));

    act(() => hook.result.current());
    hook.unmount();
    act(() => jest.runAllTimers());

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("complete");
  });
});
