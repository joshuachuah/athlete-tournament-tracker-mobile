import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

describe("errorMessage", () => {
  const fallback = "Please try again.";

  it.each([
    [new ApiError("Request timed out", 0, "TIMEOUT"), "The request took too long. Please try again."],
    [new ApiError("Network request failed", 0, "NETWORK_ERROR"), "Couldn't reach the server. Check your connection and try again."],
    [new ApiError("Unexpected response", 0, "INVALID_RESPONSE"), "Couldn't reach the server. Check your connection and try again."],
    [new ApiError("Request aborted", 0, "ABORTED"), "Couldn't reach the server. Check your connection and try again."],
  ])("maps client-side API failures to app copy", (error, expected) => {
    expect(errorMessage(error, fallback)).toBe(expected);
  });

  it("hides server internals for 5xx failures", () => {
    const rawMessage = "Traceback (most recent call last): secret";

    expect(errorMessage(new ApiError(rawMessage, 500), fallback)).toBe(
      "Something went wrong on our side. Please try again.",
    );
    expect(errorMessage(new ApiError(rawMessage, 500), fallback)).not.toContain(rawMessage);
  });

  it("keeps user-facing 4xx API copy", () => {
    expect(errorMessage(new ApiError("Prize rounds must be non-negative", 422, "VALIDATION"), fallback)).toBe(
      "Prize rounds must be non-negative",
    );
  });

  it.each([
    [new ApiError("", 400)],
    [undefined],
    [null],
    [42],
    [{}],
    [new Error("")],
  ])("uses the fallback for empty or unknown values", (error) => {
    expect(errorMessage(error, fallback)).toBe(fallback);
  });

  it.each([
    [new Error("Delete failed"), "Delete failed"],
    ["plain string", "plain string"],
  ])("keeps useful non-API error copy", (error, expected) => {
    expect(errorMessage(error, fallback)).toBe(expected);
  });
});
