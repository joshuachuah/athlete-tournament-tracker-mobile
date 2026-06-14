import {
  calculateAccommodationTotal,
  defaultTournamentDraft,
  deriveAccommodationNightly,
  deriveDraftDates,
  detailsSchema,
  resumableDraft,
  toTournamentPayload,
  tournamentToDraft,
  travelSchema,
} from "@/lib/tournament-draft";
import { roundCurrencyAmount } from "@/lib/utils";
import type { TournamentWithPnL } from "@/types";

function tournament(
  overrides: Partial<TournamentWithPnL> = {},
): TournamentWithPnL {
  return {
    id: "tournament-1",
    user_id: "athlete-1",
    name: "Open Championship",
    location: "Detroit",
    country: "United States",
    currency: "USD",
    start_date: "2026-04-01",
    end_date: "2026-04-03",
    duration_days: 3,
    entry_fee: 100,
    flight_cost: 200,
    accommodation_total: 300,
    daily_spending_cap: 75,
    coaching_cost: 50,
    misc_cost: 25,
    subsidy_by: null,
    subsidy_amount: 0,
    subsidy_covers: null,
    sponsorship_allocated: 40,
    prize_rounds: { r1: 100 },
    created_at: "2026-01-01",
    home_currency: "USD",
    pnl: {
      total_income_base: 0,
      total_expenses: 0,
      scenarios: [],
      break_even_round: null,
    },
    ...overrides,
  };
}

describe("tournamentToDraft", () => {
  it("maps scalar fields and the edit id", () => {
    const draft = tournamentToDraft(tournament());

    expect(draft).toEqual(
      expect.objectContaining({
        editId: "tournament-1",
        name: "Open Championship",
        currency: "USD",
        entry_fee: 100,
        flight_cost: 200,
        daily_spending_cap: 75,
      }),
    );
  });

  it("merges sparse prize rounds over all-zero defaults", () => {
    const draft = tournamentToDraft(
      tournament({ prize_rounds: { r1: 100 } }),
    );

    expect(draft.prize_rounds).toEqual({
      r1: 100,
      r2: 0,
      r3: 0,
      qf: 0,
      sf: 0,
      f: 0,
      w: 0,
    });
  });

  it("enables subsidies when a provider or amount is present", () => {
    expect(
      tournamentToDraft(tournament({ subsidy_by: "Sponsor" }))
        .subsidy_enabled,
    ).toBe(true);
    expect(
      tournamentToDraft(tournament({ subsidy_amount: 250 })).subsidy_enabled,
    ).toBe(true);
    expect(
      tournamentToDraft(
        tournament({ subsidy_by: null, subsidy_amount: 0 }),
      ).subsidy_enabled,
    ).toBe(false);
  });

  it("derives the nightly rate at cent precision", () => {
    const draft = tournamentToDraft(
      tournament({ accommodation_total: 101, duration_days: 3 }),
    );

    expect(draft.accommodation_nightly).toBe(50.5);
    expect(draft.accommodation_nights).toBe(2);
  });

  it.each([101, 250])(
    "round-trips a %p accommodation total over two nights",
    (accommodation_total) => {
      const draft = tournamentToDraft(
        tournament({ accommodation_total, duration_days: 3 }),
      );

      expect(
        calculateAccommodationTotal(
          draft.accommodation_nightly,
          draft.accommodation_nights,
          draft.currency,
        ),
      ).toBe(accommodation_total);
    },
  );

  it("non-cent-divisible totals still drift by sub-cent amounts when recomputed", () => {
    const draft = tournamentToDraft(
      tournament({ accommodation_total: 100, duration_days: 4 }),
    );

    expect(draft.accommodation_nightly).toBe(33.33);
    expect(
      calculateAccommodationTotal(
        draft.accommodation_nightly,
        draft.accommodation_nights,
        draft.currency,
      ),
    ).toBe(99.99);
  });

  it("preserves three-decimal currency precision", () => {
    const draft = tournamentToDraft(
      tournament({
        accommodation_total: 20.25,
        currency: "KWD",
        duration_days: 3,
      }),
    );

    expect(draft.accommodation_nightly).toBe(10.125);
    expect(
      calculateAccommodationTotal(
        draft.accommodation_nightly,
        draft.accommodation_nights,
        draft.currency,
      ),
    ).toBe(20.25);
  });

  it("uses the total as the nightly rate for one-day tournaments", () => {
    const draft = tournamentToDraft(
      tournament({ accommodation_total: 101, duration_days: 1 }),
    );

    expect(draft.accommodation_nightly).toBe(101);
    expect(draft.accommodation_nights).toBe(0);
  });
});

describe("accommodation money math", () => {
  it("uses the production total calculation and removes floating-point noise", () => {
    expect(calculateAccommodationTotal(33.33, 3, "USD")).toBe(99.99);
    expect(calculateAccommodationTotal(10.125, 1, "KWD")).toBe(10.125);
  });

  it("derives nightly rates using the currency's minor units", () => {
    expect(deriveAccommodationNightly(101, 2, "USD")).toBe(50.5);
    expect(deriveAccommodationNightly(20.25, 2, "KWD")).toBe(10.125);
    expect(deriveAccommodationNightly(101, 2, "JPY")).toBe(51);
    expect(deriveAccommodationNightly(101, 0, "USD")).toBe(101);
  });
});

describe("roundCurrencyAmount", () => {
  it("rounds with currency precision and handles binary floating-point edges", () => {
    expect(roundCurrencyAmount(1.005, "USD")).toBe(1.01);
    expect(roundCurrencyAmount(10.1254, "KWD")).toBe(10.125);
    expect(roundCurrencyAmount(10.5, "JPY")).toBe(11);
    expect(roundCurrencyAmount(99.99000000000001, "USD")).toBe(99.99);
  });

  it("falls back to two fraction digits for an invalid in-progress code", () => {
    expect(roundCurrencyAmount(10.125, "X")).toBe(10.13);
  });
});

describe("deriveDraftDates", () => {
  it("recomputes duration and clamps invalid date ranges to one day", () => {
    expect(
      deriveDraftDates({
        ...defaultTournamentDraft,
        start_date: "2026-04-01",
        end_date: "2026-04-03",
      }).duration_days,
    ).toBe(3);
    expect(
      deriveDraftDates({
        ...defaultTournamentDraft,
        start_date: "2026-04-03",
        end_date: "2026-04-01",
      }).duration_days,
    ).toBe(1);
    expect(
      deriveDraftDates({
        ...defaultTournamentDraft,
        start_date: "not-a-date",
        end_date: "also-not-a-date",
      }).duration_days,
    ).toBe(1);
  });
});

describe("resumableDraft", () => {
  it("returns a stored new-tournament draft as-is", () => {
    const stored = {
      ...defaultTournamentDraft,
      name: "Open Championship",
    };

    expect(resumableDraft(stored)).toBe(stored);
  });

  it("discards a stored draft from an abandoned edit", () => {
    const stored = {
      ...defaultTournamentDraft,
      editId: "tournament-1",
      name: "Stale edit",
    };

    expect(resumableDraft(stored)).toBe(defaultTournamentDraft);
  });
});

describe("toTournamentPayload", () => {
  it("normalizes text and stamps the user id", () => {
    const payload = toTournamentPayload(
      {
        ...defaultTournamentDraft,
        name: "  Open Championship  ",
        location: "  Detroit  ",
        country: "  United States  ",
        currency: "usd",
      },
      "athlete-1",
    );

    expect(payload).toEqual(
      expect.objectContaining({
        user_id: "athlete-1",
        name: "Open Championship",
        location: "Detroit",
        country: "United States",
        currency: "USD",
      }),
    );
  });

  it("clears subsidy values when subsidies are disabled", () => {
    const payload = toTournamentPayload(
      {
        ...defaultTournamentDraft,
        subsidy_enabled: false,
        subsidy_by: "Sponsor",
        subsidy_amount: 250,
        subsidy_covers: "flights",
      },
      "athlete-1",
    );

    expect(payload.subsidy_by).toBeNull();
    expect(payload.subsidy_amount).toBe(0);
    expect(payload.subsidy_covers).toBeNull();
  });
});

describe("wizard schemas", () => {
  it("enforces required details and non-negative travel costs", () => {
    const validDetails = {
      name: "Open Championship",
      location: "Detroit",
      country: "United States",
      currency: "USD",
      start_date: "2026-04-01",
      end_date: "2026-04-03",
      entry_fee: 0,
    };

    expect(detailsSchema.safeParse({ ...validDetails, name: "" }).success).toBe(
      false,
    );
    expect(
      detailsSchema.safeParse({ ...validDetails, currency: "US" }).success,
    ).toBe(false);
    expect(
      travelSchema.safeParse({
        flight_cost: 0,
        accommodation_nightly: 0,
        accommodation_nights: 0,
        accommodation_total: 0,
      }).success,
    ).toBe(true);
    expect(
      travelSchema.safeParse({
        flight_cost: -1,
        accommodation_nightly: 0,
        accommodation_nights: 0,
        accommodation_total: 0,
      }).success,
    ).toBe(false);
  });
});
