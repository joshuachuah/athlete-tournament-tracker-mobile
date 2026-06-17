import { z } from "zod";

import type {
  AthleteProfile,
  KnownTournament,
  PnLResult,
  PrizeRounds,
  ScenarioResult,
  Tournament,
  TournamentWithPnL,
} from "@/types";

const roundSchema = z.enum(["r1", "r2", "r3", "qf", "sf", "f", "w"]);

export const prizeRoundsSchema = z.looseObject({
  r1: z.number().optional(),
  r2: z.number().optional(),
  r3: z.number().optional(),
  qf: z.number().optional(),
  sf: z.number().optional(),
  f: z.number().optional(),
  w: z.number().optional(),
});

export const athleteProfileSchema = z.looseObject({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  home_country: z.string(),
  home_currency: z.string(),
  sport: z.string(),
  monthly_income: z.number(),
  savings_balance: z.number(),
  monthly_sponsorship: z.number(),
  created_at: z.string(),
});

export const tournamentSchema = z.looseObject({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  location: z.string(),
  country: z.string(),
  currency: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  duration_days: z.number(),
  entry_fee: z.number(),
  flight_cost: z.number(),
  accommodation_total: z.number(),
  daily_spending_cap: z.number(),
  coaching_cost: z.number(),
  misc_cost: z.number(),
  subsidy_by: z.string().nullable(),
  subsidy_amount: z.number(),
  subsidy_covers: z
    .enum(["flights", "accommodation", "full_expenses", "flat_stipend"])
    .nullable(),
  sponsorship_allocated: z.number(),
  prize_rounds: prizeRoundsSchema,
  prize_tax_rate: z.number(),
  created_at: z.string(),
});

export const scenarioResultSchema = z.looseObject({
  scenario: z.enum(["worst", "realistic", "best"]),
  round: roundSchema,
  prize_money: z.number(),
  prize_money_after_tax: z.number(),
  net_result: z.number(),
  profitable: z.boolean(),
});

export const pnlResultSchema = z.looseObject({
  total_expenses: z.number(),
  total_income_base: z.number(),
  scenarios: z.array(scenarioResultSchema),
  break_even_round: roundSchema.nullable(),
});

export const tournamentWithPnLSchema = tournamentSchema.extend({
  pnl: pnlResultSchema,
  home_currency: z.string(),
});

export const knownTournamentSchema = z.looseObject({
  id: z.string().optional(),
  name: z.string(),
  location: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  duration_days: z.number().optional(),
  tier: z.string().optional(),
  tour_level: z.string().optional(),
  estimated_prize_total: z.number().optional(),
  prize_rounds: prizeRoundsSchema.optional(),
});

export const fxConversionSchema = z.looseObject({
  converted: z.number(),
  rate: z.number(),
});

export const deleteResultSchema = z.looseObject({
  success: z.boolean(),
});

export const healthSchema = z.looseObject({
  status: z.string(),
});

type AssertAssignable<Schema extends z.ZodType, Type> =
  z.output<Schema> extends Type ? true : never;

const _assertPrizeRounds: AssertAssignable<
  typeof prizeRoundsSchema,
  PrizeRounds
> = true;
const _assertAthleteProfile: AssertAssignable<
  typeof athleteProfileSchema,
  AthleteProfile
> = true;
const _assertTournament: AssertAssignable<
  typeof tournamentSchema,
  Tournament
> = true;
const _assertScenarioResult: AssertAssignable<
  typeof scenarioResultSchema,
  ScenarioResult
> = true;
const _assertPnLResult: AssertAssignable<typeof pnlResultSchema, PnLResult> =
  true;
const _assertTournamentWithPnL: AssertAssignable<
  typeof tournamentWithPnLSchema,
  TournamentWithPnL
> = true;
const _assertKnownTournament: AssertAssignable<
  typeof knownTournamentSchema,
  KnownTournament
> = true;

void [
  _assertPrizeRounds,
  _assertAthleteProfile,
  _assertTournament,
  _assertScenarioResult,
  _assertPnLResult,
  _assertTournamentWithPnL,
  _assertKnownTournament,
];
