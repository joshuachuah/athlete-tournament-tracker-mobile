import { supabase } from "@/lib/supabase";
import type {
  AthleteProfile,
  KnownTournament,
  Tournament,
  TournamentWithPnL,
} from "@/types";

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

export const api = {
  health: () => request<{ status: string }>("/health"),
  profile: {
    get: (email: string) =>
      request<AthleteProfile | null>(
        `/api/profile?email=${encodeURIComponent(email)}`,
      ),
    save: (data: Partial<AthleteProfile> & { email: string }) =>
      request<AthleteProfile>("/api/profile", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  tournaments: {
    list: (userId: string) =>
      request<TournamentWithPnL[]>(
        `/api/tournaments?user_id=${encodeURIComponent(userId)}`,
      ),
    get: (id: string) => request<TournamentWithPnL>(`/api/tournaments/${id}`),
    create: (data: Omit<Tournament, "id" | "created_at">) =>
      request<TournamentWithPnL>("/api/tournaments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Tournament>) =>
      request<TournamentWithPnL>(`/api/tournaments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/tournaments/${id}`, {
        method: "DELETE",
      }),
    search: (query: string, sport?: string) =>
      request<KnownTournament[]>(
        `/api/tournaments/search?q=${encodeURIComponent(query)}${
          sport ? `&sport=${encodeURIComponent(sport)}` : ""
        }`,
      ),
  },
  fx: {
    convert: (from: string, to: string, amount: number) =>
      request<{
        from: string;
        to: string;
        amount: number;
        converted: number;
        rate: number;
      }>(`/api/fx?from=${from}&to=${to}&amount=${amount}`),
  },
};
