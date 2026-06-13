import { addDays } from "date-fns";
import { z } from "zod";

import type { PrizeRounds, Tournament, TournamentWithPnL } from "@/types";
import { calculateDurationDays, isoToday, roundToCents } from "@/lib/utils";

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

const today = isoToday();

export const defaultTournamentDraft: TournamentDraft = {
  name: "",
  location: "",
  country: "",
  currency: "USD",
  start_date: today,
  end_date: addDays(new Date(today), 2).toISOString().slice(0, 10),
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

const requiredText = z.string().min(1, "Required.");
const money = z.coerce.number().min(0, "Must be zero or more.");

export const detailsSchema = z.object({
  name: requiredText,
  location: requiredText,
  country: requiredText,
  currency: z.string().length(3, "Use a 3-letter code."),
  start_date: requiredText,
  end_date: requiredText,
  entry_fee: money,
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
});

export const travelSchema = z.object({
  flight_cost: money,
  accommodation_nightly: money,
  accommodation_nights: z.coerce.number().min(0),
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

export function tournamentToDraft(tournament: TournamentWithPnL): TournamentDraft {
  return {
    ...defaultTournamentDraft,
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
      ...defaultTournamentDraft.prize_rounds,
      ...tournament.prize_rounds,
    },
    flight_cost: tournament.flight_cost,
    accommodation_total: tournament.accommodation_total,
    accommodation_nightly:
      tournament.duration_days > 1
        ? roundToCents(
            tournament.accommodation_total / (tournament.duration_days - 1),
          )
        : tournament.accommodation_total,
    accommodation_nights: Math.max(0, tournament.duration_days - 1),
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
  };
}
