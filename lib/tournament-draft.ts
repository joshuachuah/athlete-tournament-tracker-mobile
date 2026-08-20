import { z } from "zod";

import type {
  KnownTournament,
  PrizeRounds,
  Tournament,
  TournamentWithPnL,
} from "@/types";
import {
  calculateDurationDays,
  parseDateOnly,
  roundCurrencyAmount,
} from "@/lib/utils";
import type { ApiRequestOptions } from "@/lib/api";
import {
  generatePrizeRounds,
  getPrizeTier,
  isDrawTemplateId,
  isPrizeTierId,
  prizeDistributionCurrency,
  type DrawTemplateId,
  type PrizeDistributionMode,
  type PrizeTierId,
} from "@/lib/prize-distributions";

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
  prize_distribution_mode: PrizeDistributionMode;
  prize_tier_id: PrizeTierId | null;
  prize_draw_template_id: DrawTemplateId | null;
  prize_player_total: number;
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
  subsidy_covers: NonNullable<Tournament["subsidy_covers"]>;
  sponsorship_allocated: number;
};

function emptyPrizeRounds(): Required<PrizeRounds> {
  return { r1: 0, r2: 0, r3: 0, qf: 0, sf: 0, f: 0, w: 0 };
}

type TournamentDraftPrefillParam = string | string[];

export type TournamentDraftPrefill = {
  name?: TournamentDraftPrefillParam;
  location?: TournamentDraftPrefillParam;
  country?: TournamentDraftPrefillParam;
  currency?: TournamentDraftPrefillParam;
  start_date?: TournamentDraftPrefillParam;
  end_date?: TournamentDraftPrefillParam;
  duration_days?: TournamentDraftPrefillParam;
};

const prizeRoundKeys = ["r1", "r2", "r3", "qf", "sf", "f", "w"] as const;
const apiDateTimePattern =
  /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

function apiDateOnly(value: string): string {
  if (parseDateOnly(value)) {
    return value;
  }

  const dateTimeMatch = apiDateTimePattern.exec(value);

  if (!dateTimeMatch || Number.isNaN(Date.parse(value))) {
    return value;
  }

  return parseDateOnly(dateTimeMatch[1]) ? dateTimeMatch[1] : value;
}

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
    prize_rounds: emptyPrizeRounds(),
    prize_tax_rate: 0,
    prize_distribution_mode: "generated",
    prize_tier_id: null,
    prize_draw_template_id: null,
    prize_player_total: 0,
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

const finiteNonNegativeNumber = z.number().finite().min(0);
const nonNegativeInteger = finiteNonNegativeNumber.int();
const persistedDateOnly = z.string().refine(
  (value) => parseDateOnly(value) !== null,
);
const persistedPrizeRoundsSchema = z.strictObject({
  r1: finiteNonNegativeNumber,
  r2: finiteNonNegativeNumber,
  r3: finiteNonNegativeNumber,
  qf: finiteNonNegativeNumber,
  sf: finiteNonNegativeNumber,
  f: finiteNonNegativeNumber,
  w: finiteNonNegativeNumber,
});
const persistedTournamentDraftV1Schema = z.strictObject({
  editId: z.string().min(1).optional(),
  name: z.string(),
  location: z.string(),
  country: z.string(),
  currency: z.string().length(3),
  start_date: persistedDateOnly,
  end_date: persistedDateOnly,
  duration_days: nonNegativeInteger,
  entry_fee: finiteNonNegativeNumber,
  prize_rounds: persistedPrizeRoundsSchema,
  prize_tax_rate: finiteNonNegativeNumber.max(100),
  flight_cost: finiteNonNegativeNumber,
  accommodation_nightly: finiteNonNegativeNumber,
  accommodation_nights: nonNegativeInteger,
  accommodation_total: finiteNonNegativeNumber,
  daily_spending_cap: finiteNonNegativeNumber,
  coaching_cost: finiteNonNegativeNumber,
  misc_cost: finiteNonNegativeNumber,
  subsidy_enabled: z.boolean(),
  subsidy_by: z.string(),
  subsidy_amount: finiteNonNegativeNumber,
  subsidy_covers: z.enum([
    "flights",
    "accommodation",
    "full_expenses",
    "flat_stipend",
  ]),
  sponsorship_allocated: finiteNonNegativeNumber,
});
const persistedTournamentDraftSchema = persistedTournamentDraftV1Schema.extend({
  prize_distribution_mode: z.enum(["generated", "manual"]),
  prize_tier_id: z
    .string()
    .refine(isPrizeTierId)
    .nullable(),
  prize_draw_template_id: z
    .string()
    .refine(isDrawTemplateId)
    .nullable(),
  prize_player_total: finiteNonNegativeNumber,
});
const storedTournamentDraftSchema = z.strictObject({
  version: z.literal(3),
  draft: persistedTournamentDraftSchema,
});
const storedTournamentDraftV2Schema = z.strictObject({
  version: z.literal(2),
  draft: persistedTournamentDraftSchema,
});
const storedTournamentDraftV1Schema = z.strictObject({
  version: z.literal(1),
  draft: persistedTournamentDraftV1Schema,
});
const legacyTournamentDraftSchema = persistedTournamentDraftV1Schema.extend({
  prize_rounds: persistedPrizeRoundsSchema.partial().optional(),
}).partial();

export function persistedTournamentDraft(draft: TournamentDraft) {
  return { version: 3 as const, draft };
}

function prizeSelectorMigration(
  prizeRounds: Required<PrizeRounds>,
): Pick<
  TournamentDraft,
  | "prize_distribution_mode"
  | "prize_tier_id"
  | "prize_draw_template_id"
  | "prize_player_total"
> {
  return {
    prize_distribution_mode: Object.values(prizeRounds).some((amount) => amount > 0)
      ? "manual"
      : "generated",
    prize_tier_id: null,
    prize_draw_template_id: null,
    prize_player_total: 0,
  };
}

function migrateV2GeneratedPrizeSchedule(
  draft: TournamentDraft,
): TournamentDraft {
  const hasPrizeRounds = Object.values(draft.prize_rounds).some(
    (amount) => amount > 0,
  );

  if (draft.prize_distribution_mode !== "generated") {
    return hasPrizeRounds
      ? draft
      : {
          ...draft,
          prize_distribution_mode: "generated",
          prize_tier_id: null,
          prize_draw_template_id: null,
          prize_player_total: 0,
        };
  }

  const currencyMatches =
    draft.currency.toUpperCase() === prizeDistributionCurrency;

  function preserveAsManualSnapshot() {
    return {
      ...draft,
      prize_distribution_mode: "manual" as const,
      prize_tier_id: null,
      prize_draw_template_id: null,
      prize_player_total: 0,
    };
  }

  if (!currencyMatches) {
    if (hasPrizeRounds) {
      return preserveAsManualSnapshot();
    }

    return {
      ...draft,
      prize_tier_id: null,
      prize_draw_template_id: null,
      prize_player_total: 0,
      prize_rounds: emptyPrizeRounds(),
    };
  }

  if (!draft.prize_tier_id) {
    return hasPrizeRounds
      ? preserveAsManualSnapshot()
      : { ...draft, prize_player_total: 0 };
  }

  const tier = getPrizeTier(draft.prize_tier_id);
  const templateId =
    tier.category === "world"
      ? tier.drawTemplateId
      : draft.prize_draw_template_id;

  if (tier.manualOnly) {
    return hasPrizeRounds
      ? preserveAsManualSnapshot()
      : {
          ...draft,
          prize_draw_template_id: null,
          prize_player_total: 0,
          prize_rounds: emptyPrizeRounds(),
        };
  }

  if (!templateId) {
    if (hasPrizeRounds) {
      return preserveAsManualSnapshot();
    }

    return {
      ...draft,
      prize_player_total: tier.playerPrizeMoney,
      prize_rounds: emptyPrizeRounds(),
    };
  }

  return {
    ...draft,
    prize_draw_template_id: templateId,
    prize_player_total: tier.playerPrizeMoney,
    prize_rounds: {
      ...emptyPrizeRounds(),
      ...generatePrizeRounds(
        tier.playerPrizeMoney,
        templateId,
        prizeDistributionCurrency,
      ),
    },
  };
}

export function normalizeTournamentDraft(stored: unknown): TournamentDraft {
  const defaults = createDefaultTournamentDraft();
  const current = storedTournamentDraftSchema.safeParse(stored);

  if (current.success) {
    return current.data.draft;
  }

  const version2 = storedTournamentDraftV2Schema.safeParse(stored);

  if (version2.success) {
    return {
      ...migrateV2GeneratedPrizeSchedule(version2.data.draft),
      // Older drafts allowed athletes to edit withholding, so the stored rate
      // cannot be treated as server-supplied once the field becomes read-only.
      prize_tax_rate: defaults.prize_tax_rate,
    };
  }

  const previous = storedTournamentDraftV1Schema.safeParse(stored);

  if (previous.success) {
    return {
      ...previous.data.draft,
      ...prizeSelectorMigration(previous.data.draft.prize_rounds),
      prize_tax_rate: defaults.prize_tax_rate,
    };
  }

  const legacy = legacyTournamentDraftSchema.safeParse(stored);

  if (!legacy.success) {
    return defaults;
  }

  const prizeRounds = {
    ...defaults.prize_rounds,
    ...legacy.data.prize_rounds,
  };

  return {
    ...defaults,
    ...legacy.data,
    ...prizeSelectorMigration(prizeRounds),
    prize_rounds: prizeRounds,
    prize_tax_rate: defaults.prize_tax_rate,
  };
}

const prefillInteger = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : value,
  nonNegativeInteger,
);
const prefillParamsSchema = z.object({
  name: z.string().min(1).optional().catch(undefined),
  location: z.string().min(1).optional().catch(undefined),
  country: z.string().min(1).optional().catch(undefined),
  currency: z
    .string()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional()
    .catch(undefined),
  start_date: persistedDateOnly.optional().catch(undefined),
  end_date: persistedDateOnly.optional().catch(undefined),
  duration_days: prefillInteger.optional().catch(undefined),
});

export function tournamentDraftFromPrefill(
  params: TournamentDraftPrefill,
): TournamentDraft {
  const defaults = createDefaultTournamentDraft();
  const parsedParams = prefillParamsSchema.parse(params);
  const next: TournamentDraft = {
    ...defaults,
    prize_rounds: { ...defaults.prize_rounds },
  };

  if (parsedParams.name) next.name = parsedParams.name;
  if (parsedParams.location) next.location = parsedParams.location;
  if (parsedParams.country) next.country = parsedParams.country;
  if (parsedParams.currency) next.currency = parsedParams.currency;
  if (parsedParams.start_date) next.start_date = parsedParams.start_date;
  if (parsedParams.end_date) next.end_date = parsedParams.end_date;
  if (parsedParams.duration_days !== undefined) {
    next.duration_days = parsedParams.duration_days;
  }

  return deriveDraftDates(next);
}

export function tournamentDraftFromKnown(
  tournament: KnownTournament,
): TournamentDraft {
  const defaults = createDefaultTournamentDraft();
  const validStartDate =
    tournament.start_date && parseDateOnly(tournament.start_date)
      ? tournament.start_date
      : undefined;
  const validEndDate =
    tournament.end_date && parseDateOnly(tournament.end_date)
      ? tournament.end_date
      : undefined;
  const endDate =
    validEndDate ??
    (validStartDate && tournament.duration_days
      ? addDateOnlyDays(validStartDate, tournament.duration_days - 1)
      : null) ??
    defaults.end_date;
  const knownCurrency = tournament.currency?.toUpperCase();

  const prizeRounds = tournament.prize_rounds
    ? { ...defaults.prize_rounds, ...tournament.prize_rounds }
    : defaults.prize_rounds;

  return deriveDraftDates({
    ...defaults,
    name: tournament.name,
    location: tournament.location ?? defaults.location,
    country: tournament.country ?? defaults.country,
    currency:
      knownCurrency?.length === 3 ? knownCurrency : defaults.currency,
    start_date: validStartDate ?? defaults.start_date,
    end_date: endDate,
    prize_rounds: prizeRounds,
    // Known-tournament prize data is a server-owned snapshot, including an
    // explicitly empty schedule. Manual mode preserves that provenance.
    prize_distribution_mode: "manual",
    prize_tax_rate: tournament.prize_tax_rate ?? defaults.prize_tax_rate,
  });
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
    // Treat API dates as calendar values. Some deployed responses still include
    // a midnight timestamp, which should never leak into the date editor.
    start_date: apiDateOnly(tournament.start_date),
    end_date: apiDateOnly(tournament.end_date),
    duration_days: tournament.duration_days,
    entry_fee: tournament.entry_fee,
    prize_rounds: {
      ...defaults.prize_rounds,
      ...tournament.prize_rounds,
    },
    prize_tax_rate: tournament.prize_tax_rate ?? 0,
    prize_distribution_mode: "manual",
    prize_tier_id: null,
    prize_draw_template_id: null,
    prize_player_total: 0,
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
    // Zero is the form's empty value. Omitting those rounds keeps saved
    // projections aligned with previews and lets the server choose scenarios
    // from the rounds the athlete actually entered.
    prize_rounds: Object.fromEntries(
      Object.entries(normalized.prize_rounds).filter(
        ([, amount]) => (amount ?? 0) > 0,
      ),
    ),
    prize_tax_rate: normalized.prize_tax_rate,
  };
}

export function toTournamentPreviewPayload(
  draft: TournamentDraft,
  userId: string,
): Omit<Tournament, "id" | "created_at"> {
  return toTournamentPayload(draft, userId);
}

type TournamentWriter = {
  create: (
    payload: Omit<Tournament, "id" | "created_at">,
    options?: ApiRequestOptions,
  ) => Promise<TournamentWithPnL>;
  update: (
    id: string,
    payload: Omit<Tournament, "id" | "created_at">,
    options?: ApiRequestOptions,
  ) => Promise<TournamentWithPnL>;
};

export function saveTournamentDraft(
  draft: TournamentDraft,
  userId: string,
  writer: TournamentWriter,
  options?: ApiRequestOptions,
) {
  const payload = toTournamentPayload(draft, userId);

  if (draft.editId) {
    return options
      ? writer.update(draft.editId, payload, options)
      : writer.update(draft.editId, payload);
  }

  return options ? writer.create(payload, options) : writer.create(payload);
}

type TournamentSaveDataCompletion = {
  invalidate: (queryKey: readonly unknown[]) => void;
  resetDraft: () => void;
};

export function completeTournamentSaveData(
  tournamentId: string,
  athleteId: string | undefined,
  completion: TournamentSaveDataCompletion,
): void {
  completion.invalidate(["tournaments", athleteId]);
  completion.invalidate(["tournament", tournamentId]);
  completion.resetDraft();
}
