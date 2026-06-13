import {
  defaultTournamentDraft,
  deriveDraftDates,
  detailsSchema,
  toTournamentPayload,
  tournamentToDraft,
  travelSchema,
} from "@/lib/tournament-draft";
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

  it("rounds nightly rate to whole units (current behavior pending drift fix)", () => {
    const draft = tournamentToDraft(
      tournament({ accommodation_total: 101, duration_days: 3 }),
    );

    expect(draft.accommodation_nightly).toBe(51);
    expect(draft.accommodation_nights).toBe(2);
  });

  it("uses the total as the nightly rate for one-day tournaments", () => {
    const draft = tournamentToDraft(
      tournament({ accommodation_total: 101, duration_days: 1 }),
    );

    expect(draft.accommodation_nightly).toBe(101);
    expect(draft.accommodation_nights).toBe(0);
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
