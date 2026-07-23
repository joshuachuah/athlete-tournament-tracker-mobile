import { z } from "zod";

import {
  athleteProfileSchema,
  deleteResultSchema,
  fxConversionSchema,
  healthSchema,
  knownTournamentSchema,
  pnlResultSchema,
  tournamentWithPnLSchema,
} from "@/lib/api-schemas";
import { supabase } from "@/lib/supabase";
import type { AthleteProfile, Tournament } from "@/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";
export const API_REQUEST_TIMEOUT_MS = 15_000;

export type ApiRequestOptions = {
  signal?: AbortSignal;
  authToken?: string;
  authenticatedUserId?: string;
};

type RequestOptions = RequestInit & ApiRequestOptions;

async function authHeaders(
  authToken?: string,
  authenticatedUserId?: string,
): Promise<Record<string, string>> {
  if (authToken !== undefined) {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  if (!supabase) {
    return {};
  }

  // getSession reads the cached session and refreshes the token if needed, so
  // every request carries a valid bearer token. The backend must verify this
  // token and derive the caller's identity from it — query params like email or
  // user_id are attacker-controlled and must not be trusted for authorization.
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (authenticatedUserId && session?.user.id !== authenticatedUserId) {
    throw new ApiError(
      "Authentication session changed",
      401,
      "AUTH_SESSION_CHANGED",
    );
  }

  const token = session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const { authenticatedUserId, authToken, ...fetchOptions } = options ?? {};
  const callerSignal = fetchOptions.signal;
  let abortCause: "caller" | "timeout" | undefined;
  let cancelFromCaller: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders(authToken, authenticatedUserId)),
      ...fetchOptions.headers,
    };
    const controller = new AbortController();

    cancelFromCaller = () => {
      if (!abortCause) {
        abortCause = "caller";
        controller.abort();
      }
    };
    if (callerSignal?.aborted) {
      cancelFromCaller();
    } else {
      callerSignal?.addEventListener("abort", cancelFromCaller, { once: true });
    }

    // The deadline covers fetch and response parsing. Auth resolution happens
    // first because the Supabase session lookup is not abortable.
    timeout = setTimeout(() => {
      if (!abortCause) {
        abortCause = "timeout";
        controller.abort();
      }
    }, API_REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new ApiError(
        error.error ?? error.message ?? "Request failed",
        response.status,
        error.code,
      );
    }

    return response.json();
  } catch (error) {
    if (abortCause === "timeout") {
      throw new ApiError("Request timed out", 0, "TIMEOUT");
    }

    if (abortCause === "caller") {
      throw new ApiError("Request aborted", 0, "ABORTED");
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    if (cancelFromCaller) {
      callerSignal?.removeEventListener("abort", cancelFromCaller);
    }
  }
}

async function requestParsed<S extends z.ZodType>(
  schema: S,
  path: string,
  options?: RequestOptions,
): Promise<z.output<S>> {
  const raw = await request<unknown>(path, options);
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    throw new ApiError(
      `Unexpected response shape from ${path.split("?")[0]}`,
      0,
      "INVALID_RESPONSE",
    );
  }

  return parsed.data;
}

export const api = {
  health: (options?: ApiRequestOptions) =>
    requestParsed(healthSchema, "/health", options),
  profile: {
    get: (email: string, options?: ApiRequestOptions) =>
      requestParsed(
        athleteProfileSchema.nullable(),
        `/api/profile?email=${encodeURIComponent(email)}`,
        options,
      ),
    save: (
      data: Partial<AthleteProfile> & { email: string },
      options?: ApiRequestOptions,
    ) =>
      requestParsed(athleteProfileSchema, "/api/profile", {
        method: "POST",
        body: JSON.stringify(data),
        signal: options?.signal,
        authToken: options?.authToken,
      }),
  },
  tournaments: {
    list: (userId: string, options?: ApiRequestOptions) =>
      requestParsed(
        z.array(tournamentWithPnLSchema),
        `/api/tournaments?user_id=${encodeURIComponent(userId)}`,
        options,
      ),
    get: (id: string, options?: ApiRequestOptions) =>
      requestParsed(tournamentWithPnLSchema, `/api/tournaments/${id}`, options),
    create: (
      data: Omit<Tournament, "id" | "created_at">,
      options?: ApiRequestOptions,
    ) =>
      requestParsed(tournamentWithPnLSchema, "/api/tournaments", {
        method: "POST",
        body: JSON.stringify(data),
        signal: options?.signal,
        authToken: options?.authToken,
        authenticatedUserId: options?.authenticatedUserId,
      }),
    preview: (
      data: Partial<Tournament>,
      options?: ApiRequestOptions,
    ) =>
      requestParsed(pnlResultSchema, "/api/tournaments/pnl-preview", {
        method: "POST",
        body: JSON.stringify(data),
        signal: options?.signal,
        authToken: options?.authToken,
        authenticatedUserId: options?.authenticatedUserId,
      }),
    update: (
      id: string,
      data: Partial<Tournament>,
      options?: ApiRequestOptions,
    ) =>
      requestParsed(tournamentWithPnLSchema, `/api/tournaments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        signal: options?.signal,
        authToken: options?.authToken,
        authenticatedUserId: options?.authenticatedUserId,
      }),
    delete: (id: string, options?: ApiRequestOptions) =>
      requestParsed(deleteResultSchema, `/api/tournaments/${id}`, {
        method: "DELETE",
        signal: options?.signal,
        authToken: options?.authToken,
        authenticatedUserId: options?.authenticatedUserId,
      }),
    search: (
      query: string,
      sport?: string,
      options?: ApiRequestOptions,
    ) =>
      requestParsed(
        z.array(knownTournamentSchema),
        `/api/tournaments/search?q=${encodeURIComponent(query)}${
          sport ? `&sport=${encodeURIComponent(sport)}` : ""
        }`,
        options,
      ),
  },
  fx: {
    convert: (
      from: string,
      to: string,
      amount: number,
      options?: ApiRequestOptions,
    ) =>
      requestParsed(
        fxConversionSchema,
        `/api/fx?from=${from}&to=${to}&amount=${amount}`,
        options,
      ),
  },
};
