import { api, ApiError, API_REQUEST_TIMEOUT_MS } from "@/lib/api";

const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe("api client", () => {
  it("returns successful responses without an authorization header", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    } as unknown as Response);

    await expect(api.health()).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      `${apiBase}/health`,
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const options = fetchMock.mock.calls[0]?.[1];
    expect(options?.headers).not.toHaveProperty("Authorization");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("maps JSON error responses to ApiError", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: "Bad payload",
        code: "VALIDATION",
      }),
    } as unknown as Response);

    const request = api.health();

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      name: "ApiError",
      message: "Bad payload",
      status: 422,
      code: "VALIDATION",
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("uses status text when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      message: "Bad Gateway",
      status: 502,
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("maps network failures to a network ApiError", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      message: "Network request failed",
      status: 0,
      code: "NETWORK_ERROR",
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("times out requests with a stable timeout ApiError", async () => {
    fetchMock.mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    });

    const request = api.health();
    const rejection = expect(request).rejects.toMatchObject({
      name: "ApiError",
      message: "Request timed out",
      status: 0,
      code: "TIMEOUT",
    });

    await jest.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);

    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("composes caller cancellation with the request timeout signal", async () => {
    const callerController = new AbortController();
    const removeEventListener = jest.spyOn(
      callerController.signal,
      "removeEventListener",
    );
    fetchMock.mockImplementation((_url, options) => {
      const signal = options?.signal;
      return new Promise((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("aborted"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });

    const request = api.health({ signal: callerController.signal });
    const rejection = expect(request).rejects.toMatchObject({
      name: "ApiError",
      message: "Request aborted",
      status: 0,
      code: "ABORTED",
    });
    await Promise.resolve();
    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal;

    expect(requestSignal).not.toBe(callerController.signal);
    callerController.abort();

    await rejection;
    expect(requestSignal?.aborted).toBe(true);
    expect(removeEventListener).toHaveBeenCalledWith(
      "abort",
      expect.any(Function),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it("handles a caller signal that is already aborted", async () => {
    const callerController = new AbortController();
    callerController.abort();
    fetchMock.mockImplementation((_url, options) => {
      expect(options?.signal?.aborted).toBe(true);
      return Promise.reject(new Error("aborted"));
    });

    await expect(
      api.health({ signal: callerController.signal }),
    ).rejects.toMatchObject({
      name: "ApiError",
      message: "Request aborted",
      status: 0,
      code: "ABORTED",
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps the first abort cause when timeout and caller cancellation race", async () => {
    const callerController = new AbortController();
    fetchMock.mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    });
    const request = api.health({ signal: callerController.signal });
    const rejection = expect(request).rejects.toMatchObject({
      message: "Request timed out",
      code: "TIMEOUT",
    });

    await jest.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    callerController.abort();

    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("preserves timeout mapping while parsing an HTTP error body", async () => {
    fetchMock.mockImplementation((_url, options) => {
      return Promise.resolve({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: () =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      } as Response);
    });
    const request = api.health();
    const rejection = expect(request).rejects.toMatchObject({
      message: "Request timed out",
      status: 0,
      code: "TIMEOUT",
    });

    await jest.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);

    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("preserves caller abort mapping while parsing an HTTP error body", async () => {
    const callerController = new AbortController();
    const jsonMock = jest.fn(
      (signal?: AbortSignal | null) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );
    fetchMock.mockImplementation((_url, options) => {
      return Promise.resolve({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: () => jsonMock(options?.signal),
      } as Response);
    });
    const request = api.health({ signal: callerController.signal });
    const rejection = expect(request).rejects.toMatchObject({
      message: "Request aborted",
      status: 0,
      code: "ABORTED",
    });
    for (let attempt = 0; attempt < 3 && !jsonMock.mock.calls.length; attempt++) {
      await Promise.resolve();
    }
    expect(jsonMock).toHaveBeenCalledTimes(1);

    callerController.abort();

    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("encodes query parameters", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => null,
    } as Response);

    await api.profile.get("a+b@x.com");

    expect(fetchMock).toHaveBeenCalledWith(
      `${apiBase}/api/profile?email=a%2Bb%40x.com`,
      expect.any(Object),
    );
  });

  it("accepts the documented FX response shape", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ converted: 91.5, rate: 0.915 }),
    } as unknown as Response);

    await expect(api.fx.convert("USD", "EUR", 100)).resolves.toEqual({
      converted: 91.5,
      rate: 0.915,
    });
  });

  it("rejects successful responses with an invalid shape", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ totally: "wrong" }),
    } as unknown as Response);

    const request = api.tournaments.get("t1");

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      name: "ApiError",
      message: "Unexpected response shape from /api/tournaments/t1",
      status: 0,
      code: "INVALID_RESPONSE",
    });
  });
});
