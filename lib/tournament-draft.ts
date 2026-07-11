import { z } from "zod";

import type { PrizeRounds, Tournament, TournamentWithPnL } from "@/types";
import {
  calculateDurationDays,
  parseDateOnly,
  roundCurrencyAmount,
} from "@/lib/utils";

export type TournamentDraft = {
  editId?: string;
  name: string;
  location: string;
  country: string;
  currency: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  entry_fee: number;
  prize_rounds: Required<PrizeRounds>;
  prize_tax_rate: number;
  flight_cost: number;
  accommodation_nightly: number;
  accommodation_nights: number;
  accommodation_total: number;
  daily_spending_cap: number;
  coaching_cost: number;
  misc_cost: number;
  subsidy_enabled: boolean;
  subsidy_by: string;
  subsidy_amount: number;
  subsidy_covers: Tournament["subsidy_covers"];
  sponsorship_allocated: number;
};

export type TournamentDraftPrefill = {
  name?: string;
  location?: string;
  country?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: string;
  prize_rounds?: string;
  prize_tax_rate?: string;
};

function localDateOnly(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDateOnlyDays(value: string, days: number): string | null {
  const date = parseDateOnly(value);

  if (!date) {
    return null;
  }

  date.setDate(date.getDate() + days);
  return localDateOnly(date);
}

export function createDefaultTournamentDraft(
  now: Date = new Date(),
): TournamentDraft {
  const startDate = localDateOnly(now);

  return {
    name: "",
    location: "",
    country: "",
    currency: "USD",
    start_date: startDate,
    end_date: addDateOnlyDays(startDate, 2) ?? startDate,
    duration_days: 3,
    entry_fee: 0,
    prize_rounds: {
      r1: 0,
      r2: 0,
      r3: 0,
      qf: 0,
      sf: 0,
      f: 0,
      w: 0,
    },
    prize_tax_rate: 0,
    flight_cost: 0,
    accommodation_nightly: 0,
    accommodation_nights: 0,
    accommodation_total: 0,
    daily_spending_cap: 0,
    coaching_cost: 0,
    misc_cost: 0,
    subsidy_enabled: false,
    subsidy_by: "",
    subsidy_amount: 0,
    subsidy_covers: "flat_stipend",
    sponsorship_allocated: 0,
  };
}

const requiredText = z.string().min(1, "Required.");
const money = z.coerce.number().min(0, "Must be zero or more.");
const dateOnly = z.string().refine((value) => parseDateOnly(value) !== null, {
  message: "Use a valid date in YYYY-MM-DD format.",
});

export const detailsSchema = z
  .object({
    name: requiredText,
    location: requiredText,
    country: requiredText,
    currency: z.string().length(3, "Use a 3-letter code."),
    start_date: dateOnly,
    end_date: dateOnly,
    entry_fee: money,
  })
  .superRefine((details, context) => {
    const start = parseDateOnly(details.start_date);
    const end = parseDateOnly(details.end_date);

    if (start && end && end < start) {
      context.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "End date must be on or after start date.",
      });
    }
  });

export const prizesSchema = z.object({
  prize_rounds: z.object({
    r1: money,
    r2: money,
    r3: money,
    qf: money,
    sf: money,
    f: money,
    w: money,
  }),
  prize_tax_rate: z.coerce
    .number()
    .min(0, "Must be between 0 and 100.")
    .max(100, "Must be between 0 and 100."),
});

export const travelSchema = z.object({
  flight_cost: money,
  accommodation_nightly: money,
  accommodation_nights: z.coerce
    .number()
    .int("Must be a whole number.")
    .min(0, "Must be zero or more."),
  accommodation_total: money,
});

export const subsidySchema = z.object({
  subsidy_enabled: z.boolean(),
  subsidy_by: z.string(),
  subsidy_amount: money,
  subsidy_covers: z.enum([
    "flights",
    "accommodation",
    "full_expenses",
    "flat_stipend",
  ]),
  sponsorship_allocated: money,
});

export const spendingSchema = z.object({
  daily_spending_cap: money,
  coaching_cost: money,
  misc_cost: money,
});

export function calculateAccommodationTotal(
  nightly: number,
  nights: number,
  currency: string,
): number {
  return roundCurrencyAmount(nightly * nights, currency);
}

export function deriveAccommodationNightly(
  total: number,
  nights: number,
  currency: string,
): number {
  return nights > 0 ? roundCurrencyAmount(total / nights, currency) : total;
}

// Abandoned edits must restart from the server record so a stale editId cannot
// cause a later wizard submission to update the wrong tournament.
export function resumableDraft(stored: TournamentDraft): TournamentDraft {
  return stored.editId ? createDefaultTournamentDraft() : stored;
}

type StoredTournamentDraft = Partial<Omit<TournamentDraft, "prize_rounds">> & {
  prize_rounds?: Partial<TournamentDraft["prize_rounds"]>;
};

export function normalizeTournamentDraft(stored: StoredTournamentDraft): TournamentDraft {
  const defaults = createDefaultTournamentDraft();

  return {
    ...defaults,
    ...stored,
    prize_rounds: {
      ...defaults.prize_rounds,
      ...stored.prize_rounds,
    },
    prize_tax_rate: stored.prize_tax_rate ?? defaults.prize_tax_rate,
  };
}

export function tournamentDraftFromPrefill(
  params: TournamentDraftPrefill,
): TournamentDraft {
  const defaults = createDefaultTournamentDraft();
  const next = {
    ...defaults,
    prize_rounds: { ...defaults.prize_rounds },
  };

  if (params.name) next.name = String(params.name);
  if (params.location) next.location = String(params.location);
  if (params.country) next.country = String(params.country);
  if (params.currency) next.currency = String(params.currency).toUpperCase();
  if (params.start_date) next.start_date = String(params.start_date);
  if (params.end_date) next.end_date = String(params.end_date);
  if (params.duration_days) next.duration_days = Number(params.duration_days);
  if (params.prize_tax_rate) next.prize_tax_rate = Number(params.prize_tax_rate);
  if (params.prize_rounds) {
    try {
      next.prize_rounds = {
        ...next.prize_rounds,
        ...JSON.parse(String(params.prize_rounds)),
      };
    } catch {
      // Ignore malformed prefill data from navigation params.
    }
  }

  return deriveDraftDates(next);
}

export function tournamentToDraft(tournament: TournamentWithPnL): TournamentDraft {
  const accommodationNights = Math.max(0, tournament.duration_days - 1);
  const defaults = createDefaultTournamentDraft();

  return {
    ...defaults,
    editId: tournament.id,
    name: tournament.name,
    location: tournament.location,
    country: tournament.country,
    currency: tournament.currency,
    start_date: tournament.start_date,
    end_date: tournament.end_date,
    duration_days: tournament.duration_days,
    entry_fee: tournament.entry_fee,
    prize_rounds: {
      ...defaults.prize_rounds,
      ...tournament.prize_rounds,
    },
    prize_tax_rate: tournament.prize_tax_rate ?? 0,
    flight_cost: tournament.flight_cost,
    accommodation_total: tournament.accommodation_total,
    accommodation_nightly: deriveAccommodationNightly(
      tournament.accommodation_total,
      accommodationNights,
      tournament.currency,
    ),
    accommodation_nights: accommodationNights,
    daily_spending_cap: tournament.daily_spending_cap,
    coaching_cost: tournament.coaching_cost,
    misc_cost: tournament.misc_cost,
    subsidy_enabled: Boolean(tournament.subsidy_by || tournament.subsidy_amount),
    subsidy_by: tournament.subsidy_by ?? "",
    subsidy_amount: tournament.subsidy_amount,
    subsidy_covers: tournament.subsidy_covers ?? "flat_stipend",
    sponsorship_allocated: tournament.sponsorship_allocated,
  };
}

export function deriveDraftDates(draft: TournamentDraft): TournamentDraft {
  return {
    ...draft,
    duration_days: calculateDurationDays(draft.start_date, draft.end_date),
  };
}

export function toTournamentPayload(
  draft: TournamentDraft,
  userId: string,
): Omit<Tournament, "id" | "created_at"> {
  const normalized = deriveDraftDates(draft);

  return {
    user_id: userId,
    name: normalized.name.trim(),
    location: normalized.location.trim(),
    country: normalized.country.trim(),
    currency: normalized.currency.toUpperCase(),
    start_date: normalized.start_date,
    end_date: normalized.end_date,
    duration_days: normalized.duration_days,
    entry_fee: normalized.entry_fee,
    flight_cost: normalized.flight_cost,
    accommodation_total: normalized.accommodation_total,
    daily_spending_cap: normalized.daily_spending_cap,
    coaching_cost: normalized.coaching_cost,
    misc_cost: normalized.misc_cost,
    subsidy_by: normalized.subsidy_enabled ? normalized.subsidy_by.trim() : null,
    subsidy_amount: normalized.subsidy_enabled ? normalized.subsidy_amount : 0,
    subsidy_covers: normalized.subsidy_enabled ? normalized.subsidy_covers : null,
    sponsorship_allocated: normalized.sponsorship_allocated,
    prize_rounds: normalized.prize_rounds,
    prize_tax_rate: normalized.prize_tax_rate,
  };
}

type TournamentWriter = {
  create: (
    payload: Omit<Tournament, "id" | "created_at">,
  ) => Promise<{ id: string }>;
  update: (
    id: string,
    payload: Omit<Tournament, "id" | "created_at">,
  ) => Promise<{ id: string }>;
};

export function saveTournamentDraft(
  draft: TournamentDraft,
  userId: string,
  writer: TournamentWriter,
) {
  const payload = toTournamentPayload(draft, userId);

  if (draft.editId) {
    return writer.update(draft.editId, payload);
  }

  return writer.create(payload);
}

type TournamentSaveCompletion = {
  invalidate: (queryKey: readonly unknown[]) => void;
  resetDraft: () => void;
  replace: (href: `/tournaments/${string}`) => void;
};

export function completeTournamentSave(
  tournamentId: string,
  athleteId: string | undefined,
  completion: TournamentSaveCompletion,
): void {
  completion.invalidate(["tournaments", athleteId]);
  completion.invalidate(["tournament", tournamentId]);
  completion.resetDraft();
  completion.replace(`/tournaments/${tournamentId}`);
}
