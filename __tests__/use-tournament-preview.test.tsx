import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { useTournamentPreview } from "@/hooks/use-tournament-preview";
import { api } from "@/lib/api";
import { createDefaultTournamentDraft } from "@/lib/tournament-draft";

jest.mock("@/lib/api", () => ({
  api: { tournaments: { preview: jest.fn() } },
}));

const mockPreview = api.tournaments.preview as jest.MockedFunction<
  typeof api.tournaments.preview
>;

type PreviewResult = Awaited<ReturnType<typeof api.tournaments.preview>>;

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function previewDraft() {
  const defaults = createDefaultTournamentDraft(new Date(2026, 0, 1));
  return {
    ...defaults,
    name: "Malaysia Open",
    location: "Kuala Lumpur",
    country: "Malaysia",
    country_code: "MY" as const,
    prize_tax_rate: 10,
    prize_rounds: { ...defaults.prize_rounds, w: 100 },
  };
}

function previewResult(rate: number): PreviewResult {
  return {
    total_expenses: 0,
    total_income_base: 0,
    break_even_round: null,
    estimated_withholding_rate: rate,
    prize_rounds_after_estimated_withholding: { w: 100 - rate },
    scenarios: [],
  };
}

describe("useTournamentPreview", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPreview.mockReset();
  });

  afterEach(() => jest.useRealTimers());

  it("hides the previous result while changed inputs are debouncing", async () => {
    let resolveUpdatedPreview: ((value: PreviewResult) => void) | undefined;
    mockPreview
      .mockResolvedValueOnce(previewResult(10))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUpdatedPreview = resolve;
          }),
      );

    const initialDraft = previewDraft();
    const { result, rerender } = renderHook(
      ({ rate }: { rate: number }) =>
        useTournamentPreview({
          authenticatedUserId: "account-1",
          draft: { ...initialDraft, prize_tax_rate: rate },
          enabled: true,
          homeCurrency: "USD",
          profileId: "athlete-1",
        }),
      { initialProps: { rate: 10 }, wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.data?.estimated_withholding_rate).toBe(10),
    );
    expect(mockPreview.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        authenticatedUserId: "account-1",
        signal: expect.anything(),
      }),
    );

    rerender({ rate: 20 });

    expect(result.current.isLoadingPreview).toBe(true);
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(350);
    });

    expect(result.current.isLoadingPreview).toBe(true);
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2));
    expect(mockPreview.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        authenticatedUserId: "account-1",
        signal: expect.anything(),
      }),
    );

    await act(async () => {
      resolveUpdatedPreview?.(previewResult(20));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.data?.estimated_withholding_rate).toBe(20),
    );
  });

  it("clears cached data when previewing becomes disabled", async () => {
    mockPreview.mockResolvedValue(previewResult(10));
    const draft = previewDraft();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useTournamentPreview({
          authenticatedUserId: "account-1",
          draft,
          enabled,
          homeCurrency: "USD",
          profileId: "athlete-1",
        }),
      { initialProps: { enabled: true }, wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.data?.estimated_withholding_rate).toBe(10),
    );

    rerender({ enabled: false });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(false);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(350);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(false);
    expect(mockPreview).toHaveBeenCalledTimes(1);
  });
});
