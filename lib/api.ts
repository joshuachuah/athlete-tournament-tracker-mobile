import { z } from "zod";

import {
  athleteProfileSchema,
  deleteResultSchema,
  fxConversionSchema,
  healthSchema,
  knownTournamentSchema,
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

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) {
    return {};
  }

  // getSession reads the cached session and refreshes the token if needed, so
  // every request carries a valid bearer token. The backend must verify this
  // token and derive the caller's identity from it — query params like email or
  // user_id are attacker-controlled and must not be trusted for authorization.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...options?.headers,
      },
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
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  }
}

async function requestParsed<S extends z.ZodType>(
  schema: S,
  path: string,
  options?: RequestInit,
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
  health: () => requestParsed(healthSchema, "/health"),
  profile: {
    get: (email: string) =>
      requestParsed(
        athleteProfileSchema.nullable(),
        `/api/profile?email=${encodeURIComponent(email)}`,
      ),
    save: (data: Partial<AthleteProfile> & { email: string }) =>
      requestParsed(athleteProfileSchema, "/api/profile", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  tournaments: {
    list: (userId: string) =>
      requestParsed(
        z.array(tournamentWithPnLSchema),
        `/api/tournaments?user_id=${encodeURIComponent(userId)}`,
      ),
    get: (id: string) =>
      requestParsed(tournamentWithPnLSchema, `/api/tournaments/${id}`),
    create: (data: Omit<Tournament, "id" | "created_at">) =>
      requestParsed(tournamentWithPnLSchema, "/api/tournaments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Tournament>) =>
      requestParsed(tournamentWithPnLSchema, `/api/tournaments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      requestParsed(deleteResultSchema, `/api/tournaments/${id}`, {
        method: "DELETE",
      }),
    search: (query: string, sport?: string) =>
      requestParsed(
        z.array(knownTournamentSchema),
        `/api/tournaments/search?q=${encodeURIComponent(query)}${
          sport ? `&sport=${encodeURIComponent(sport)}` : ""
        }`,
      ),
  },
  fx: {
    convert: (from: string, to: string, amount: number) =>
      requestParsed(
        fxConversionSchema,
        `/api/fx?from=${from}&to=${to}&amount=${amount}`,
      ),
  },
};
