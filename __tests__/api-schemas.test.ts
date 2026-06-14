import {
  athleteProfileSchema,
  knownTournamentSchema,
  tournamentWithPnLSchema,
} from "@/lib/api-schemas";

const tournament = {
  id: "tournament-1",
  user_id: "athlete-1",
  name: "Tournament 1",
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
  coaching_cost: 0,
  misc_cost: 0,
  subsidy_by: null,
  subsidy_amount: 0,
  subsidy_covers: null,
  sponsorship_allocated: 0,
  prize_rounds: { r1: 0, r2: 100, qf: 300, w: 900 },
  created_at: "2026-01-01",
  home_currency: "USD",
  pnl: {
    total_income_base: 700,
    total_expenses: 1200,
    break_even_round: "qf",
    scenarios: [
      {
        scenario: "worst",
        round: "r1",
        prize_money: 0,
        net_result: -1200,
        profitable: false,
      },
      {
        scenario: "realistic",
        round: "qf",
        prize_money: 700,
        net_result: -500,
        profitable: false,
      },
      {
        scenario: "best",
        round: "w",
        prize_money: 1400,
        net_result: 200,
        profitable: true,
      },
    ],
  },
};

describe("API response schemas", () => {
  describe("tournamentWithPnLSchema", () => {
    it("accepts a complete tournament response", () => {
      expect(tournamentWithPnLSchema.parse(tournament)).toEqual(tournament);
    });

    it("preserves unknown fields for additive backend changes", () => {
      const response = { ...tournament, some_new_field: 1 };

      expect(tournamentWithPnLSchema.parse(response)).toEqual(response);
    });

    it("rejects a response without pnl", () => {
      const { pnl: _pnl, ...response } = tournament;

      expect(tournamentWithPnLSchema.safeParse(response).success).toBe(false);
    });

    it("rejects scenarios with the wrong container type", () => {
      const response = {
        ...tournament,
        pnl: { ...tournament.pnl, scenarios: "not-an-array" },
      };

      expect(tournamentWithPnLSchema.safeParse(response).success).toBe(false);
    });
  });

  it("accepts a null athlete profile", () => {
    expect(athleteProfileSchema.nullable().parse(null)).toBeNull();
  });

  it("accepts a known tournament with only its required name", () => {
    expect(knownTournamentSchema.parse({ name: "X" })).toEqual({ name: "X" });
  });
});
