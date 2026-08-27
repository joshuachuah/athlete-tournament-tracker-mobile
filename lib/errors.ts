import type { ApiError } from "@/lib/api";

const NETWORK_COPY =
  "Couldn't reach the server. Check your connection and try again.";
const TIMEOUT_COPY = "The request took too long. Please try again.";
const SERVER_COPY = "Something went wrong on our side. Please try again.";

/** Turns any thrown value into text that is safe to show the athlete. */
export function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    switch (error.code) {
      case "TIMEOUT":
        return TIMEOUT_COPY;
      case "NETWORK_ERROR":
      case "INVALID_RESPONSE":
      case "ABORTED":
        return NETWORK_COPY;
    }

    if (error.status >= 500) {
      return SERVER_COPY;
    }

    return error.message.trim() || fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    error.name === "ApiError" &&
    typeof (error as { status?: unknown }).status === "number"
  );
}
