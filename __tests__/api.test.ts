import { api, ApiError } from "@/lib/api";

const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

afterAll(() => {
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
  });

  it("maps network failures to a network ApiError", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      message: "Network request failed",
      status: 0,
      code: "NETWORK_ERROR",
    });
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
