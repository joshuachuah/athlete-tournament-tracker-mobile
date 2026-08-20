import {
  addDateOnlyDays,
  calculateAccommodationTotal,
  createDefaultTournamentDraft,
  deriveAccommodationNightly,
  deriveDraftDates,
  detailsSchema,
  normalizeTournamentDraft,
  persistedTournamentDraft,
  prizesSchema,
  resumableDraft,
  saveTournamentDraft,
  toTournamentPayload,
  toTournamentPreviewPayload,
  tournamentDraftFromKnown,
  tournamentDraftFromPrefill,
  tournamentToDraft,
  travelSchema,
} from "@/lib/tournament-draft";
import { roundCurrencyAmount } from "@/lib/utils";
import type { TournamentWithPnL } from "@/types";

const defaultTournamentDraft = createDefaultTournamentDraft(
  new Date(2026, 0, 1),
);

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
    prize_tax_rate: 0,
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
        prize_distribution_mode: "manual",
        prize_tier_id: null,
        prize_draw_template_id: null,
      }),
    );
  });

  it("removes legacy midnight timestamps from editable dates", () => {
    const draft = tournamentToDraft(
      tournament({
        start_date: "2026-04-01T00:00:00",
        end_date: "2026-04-03T00:00:00Z",
      }),
    );

    expect(draft.start_date).toBe("2026-04-01");
    expect(draft.end_date).toBe("2026-04-03");
  });

  it.each([
    "2026-04-01T",
    "2026-04-01Totally-invalid",
    "2026-04-01T25:00:00Z",
    "2026-02-29T00:00:00Z",
  ])("leaves malformed API date %s visible for form validation", (start_date) => {
    expect(tournamentToDraft(tournament({ start_date })).start_date).toBe(
      start_date,
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

  it("preserves prize tax rate for edit drafts", () => {
    const draft = tournamentToDraft(tournament({ prize_tax_rate: 30 }));

    expect(draft.prize_tax_rate).toBe(30);
  });

  it("round-trips tournament-currency fields without relabeling home-currency values", () => {
    const source = tournament({
      currency: "EUR",
      home_currency: "USD",
      entry_fee: 125,
      flight_cost: 240,
      accommodation_total: 360,
      daily_spending_cap: 85,
      coaching_cost: 45,
      misc_cost: 15,
      subsidy_amount: 50,
      sponsorship_allocated: 30,
      prize_rounds: { r1: 150, qf: 900, w: 2_500 },
    });

    const draft = tournamentToDraft(source);
    const payload = toTournamentPayload(draft, source.user_id);

    expect(draft).toEqual(
      expect.objectContaining({
        currency: "EUR",
        entry_fee: 125,
        flight_cost: 240,
        accommodation_total: 360,
        daily_spending_cap: 85,
        coaching_cost: 45,
        misc_cost: 15,
        subsidy_amount: 50,
        sponsorship_allocated: 30,
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        currency: "EUR",
        entry_fee: 125,
        flight_cost: 240,
        accommodation_total: 360,
        daily_spending_cap: 85,
        coaching_cost: 45,
        misc_cost: 15,
        subsidy_amount: 50,
        sponsorship_allocated: 30,
        prize_rounds: {
          r1: 150,
          qf: 900,
          w: 2_500,
        },
      }),
    );
  });

  it("sends a complete monetary payload when an edit changes currency", () => {
    const draft = {
      ...tournamentToDraft(tournament()),
      currency: "GBP",
    };

    expect(toTournamentPayload(draft, "athlete-1")).toEqual(
      expect.objectContaining({
        currency: "GBP",
        entry_fee: expect.any(Number),
        flight_cost: expect.any(Number),
        accommodation_total: expect.any(Number),
        daily_spending_cap: expect.any(Number),
        coaching_cost: expect.any(Number),
        misc_cost: expect.any(Number),
        subsidy_amount: expect.any(Number),
        sponsorship_allocated: expect.any(Number),
        prize_rounds: { r1: expect.any(Number) },
      }),
    );
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
  it("recomputes duration without treating invalid ranges as one-day events", () => {
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
    ).toBe(0);
    expect(
      deriveDraftDates({
        ...defaultTournamentDraft,
        start_date: "not-a-date",
        end_date: "also-not-a-date",
      }).duration_days,
    ).toBe(0);
  });
});

describe("default tournament dates", () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    jest.useRealTimers();
    process.env.TZ = originalTimezone;
  });

  it("adds calendar days across the Los Angeles DST boundary", () => {
    process.env.TZ = "America/Los_Angeles";

    expect(addDateOnlyDays("2026-03-08", 2)).toBe("2026-03-10");
  });

  it("creates new defaults at call time instead of freezing the module day", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 8, 23, 59));

    expect(createDefaultTournamentDraft().start_date).toBe("2026-03-08");

    jest.setSystemTime(new Date(2026, 2, 9, 0, 1));

    expect(createDefaultTournamentDraft()).toEqual(
      expect.objectContaining({
        start_date: "2026-03-09",
        end_date: "2026-03-11",
      }),
    );
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

    const resumed = resumableDraft(stored);

    expect(resumed.editId).toBeUndefined();
    expect(resumed.name).toBe("");
  });
});

describe("tournamentDraftFromPrefill", () => {
  it("hydrates supplied identity fields and derives duration", () => {
    const draft = tournamentDraftFromPrefill({
      name: "Known Open",
      location: "Paris",
      country: "France",
      currency: "eur",
      start_date: "2026-05-01",
      end_date: "2026-05-04",
      duration_days: "99",
    });

    expect(draft).toEqual(
      expect.objectContaining({
        name: "Known Open",
        location: "Paris",
        country: "France",
        currency: "EUR",
        start_date: "2026-05-01",
        end_date: "2026-05-04",
        duration_days: 4,
        prize_tax_rate: 0,
      }),
    );
    expect(draft.prize_rounds).toEqual(defaultTournamentDraft.prize_rounds);
  });

  it("ignores financial values supplied through untrusted route params", () => {
    const routeParams = {
      name: "Known Open",
      prize_rounds: JSON.stringify({ w: 999_999 }),
      prize_tax_rate: "30",
    };
    const draft = tournamentDraftFromPrefill(routeParams);

    expect(draft.prize_distribution_mode).toBe("generated");
    expect(draft.prize_rounds).toEqual(defaultTournamentDraft.prize_rounds);
    expect(draft.prize_tax_rate).toBe(0);
  });

  it("ignores invalid scalar params independently", () => {
    const draft = tournamentDraftFromPrefill({
      name: "Known Open",
      currency: "US",
      start_date: "not-a-date",
    });

    expect(draft.name).toBe("Known Open");
    expect(draft.currency).toBe(defaultTournamentDraft.currency);
    expect(draft.start_date).toBe(createDefaultTournamentDraft().start_date);
    expect(draft.prize_tax_rate).toBe(defaultTournamentDraft.prize_tax_rate);
  });

  it("ignores array-valued navigation params", () => {
    const draft = tournamentDraftFromPrefill({
      name: "Known Open",
      currency: ["EUR"],
      start_date: ["2026-05-01"],
      duration_days: ["4"],
    });

    expect(draft.name).toBe("Known Open");
    expect(draft.currency).toBe(defaultTournamentDraft.currency);
    expect(draft.start_date).toBe(createDefaultTournamentDraft().start_date);
    expect(draft.prize_rounds).toEqual(defaultTournamentDraft.prize_rounds);
    expect(draft.prize_tax_rate).toBe(defaultTournamentDraft.prize_tax_rate);
  });
});

describe("tournamentDraftFromKnown", () => {
  it("replaces event-owned and currency-sensitive values with the selected tournament", () => {
    const draft = tournamentDraftFromKnown({
      name: "Replacement Open",
      location: "Paris",
      country: "France",
      currency: "EUR",
      start_date: "2026-06-01",
      duration_days: 4,
      prize_rounds: { qf: 500 },
      prize_tax_rate: 20,
    });

    expect(draft).toEqual(
      expect.objectContaining({
        name: "Replacement Open",
        location: "Paris",
        country: "France",
        currency: "EUR",
        start_date: "2026-06-01",
        end_date: "2026-06-04",
        duration_days: 4,
        entry_fee: 0,
        flight_cost: 0,
        accommodation_total: 0,
        prize_tax_rate: 20,
      }),
    );
    expect(draft.prize_rounds).toEqual({
      ...defaultTournamentDraft.prize_rounds,
      qf: 500,
    });
  });

  it("uses clean defaults when a known tournament omits optional event data", () => {
    const draft = tournamentDraftFromKnown({
      name: "Sparse Open",
    });

    expect(draft).toEqual(
      expect.objectContaining({
        name: "Sparse Open",
        location: "",
        country: "",
        currency: "USD",
        entry_fee: 0,
        prize_tax_rate: 0,
      }),
    );
    expect(draft.prize_rounds).toEqual(defaultTournamentDraft.prize_rounds);
  });
});

describe("normalizeTournamentDraft", () => {
  it("backfills fields missing from older stored drafts", () => {
    const draft = normalizeTournamentDraft({
      name: "Stored draft",
      prize_rounds: { r1: 100 },
    });

    expect(draft.name).toBe("Stored draft");
    expect(draft.prize_tax_rate).toBe(0);
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

  it("loads the current versioned persisted shape", () => {
    const storedDraft = {
      ...defaultTournamentDraft,
      name: "Current stored draft",
      prize_tier_id: "world_bronze" as const,
      prize_draw_template_id: "draw_32_entries_24" as const,
      prize_player_total: 47_500,
      prize_rounds: { ...defaultTournamentDraft.prize_rounds, qf: 2_137.5 },
      prize_tax_rate: 30,
    };

    const persisted = persistedTournamentDraft(storedDraft);

    expect(persisted.version).toBe(3);
    expect(normalizeTournamentDraft(persisted)).toEqual(storedDraft);
  });

  it("repairs an edited generated World schedule from a v2 draft", () => {
    const storedDraft = {
      ...defaultTournamentDraft,
      name: "Interrupted generated draft",
      prize_tier_id: "world_bronze" as const,
      prize_draw_template_id: "draw_32_entries_24" as const,
      prize_player_total: 47_500,
      prize_rounds: {
        ...defaultTournamentDraft.prize_rounds,
        r1: 0,
        qf: 2_137.5,
      },
      prize_tax_rate: 30,
    };

    const repaired = normalizeTournamentDraft({ version: 2, draft: storedDraft });

    expect(repaired.prize_player_total).toBe(47_500);
    expect(repaired.prize_tax_rate).toBe(0);
    expect(repaired.prize_rounds).toEqual({
      r1: 831.25,
      r2: 1_306.25,
      r3: 0,
      qf: 2_137.5,
      sf: 3_562.5,
      f: 5_700,
      w: 9_025,
    });
  });

  it("repairs an edited generated Challenger schedule from a v2 draft", () => {
    const storedDraft = {
      ...defaultTournamentDraft,
      prize_tier_id: "challenger_6_none" as const,
      prize_draw_template_id: "draw_16_entries_16" as const,
      prize_player_total: 6_000,
      prize_rounds: {
        ...defaultTournamentDraft.prize_rounds,
        r1: 0,
        qf: 330,
      },
    };

    const repaired = normalizeTournamentDraft({ version: 2, draft: storedDraft });

    expect(repaired.prize_rounds).toEqual({
      r1: 195,
      r2: 0,
      r3: 0,
      qf: 330,
      sf: 540,
      f: 840,
      w: 1_200,
    });
  });

  it("preserves manual v2 payout values while clearing editable withholding", () => {
    const storedDraft = {
      ...defaultTournamentDraft,
      prize_distribution_mode: "manual" as const,
      prize_tier_id: "world_bronze" as const,
      prize_draw_template_id: "draw_32_entries_24" as const,
      prize_player_total: 47_500,
      prize_rounds: { ...defaultTournamentDraft.prize_rounds, r3: 700 },
      prize_tax_rate: 30,
    };

    expect(normalizeTournamentDraft({ version: 2, draft: storedDraft })).toEqual({
      ...storedDraft,
      prize_tax_rate: 0,
    });
  });

  it("preserves entered non-USD v2 payouts as a manual snapshot", () => {
    const storedDraft = {
      ...defaultTournamentDraft,
      currency: "EUR",
      prize_tier_id: "world_bronze" as const,
      prize_draw_template_id: "draw_32_entries_24" as const,
      prize_player_total: 47_500,
      prize_rounds: { ...defaultTournamentDraft.prize_rounds, qf: 500 },
    };

    expect(
      normalizeTournamentDraft({ version: 2, draft: storedDraft }),
    ).toEqual(
      expect.objectContaining({
        prize_distribution_mode: "manual",
        prize_tier_id: null,
        prize_draw_template_id: null,
        prize_player_total: 0,
        prize_rounds: storedDraft.prize_rounds,
      }),
    );
  });

  it("keeps an empty v2 unavailable tier as an explicit selection", () => {
    const storedDraft = {
      ...defaultTournamentDraft,
      prize_tier_id: "world_tour_finals" as const,
      prize_draw_template_id: null,
      prize_player_total: 285_000,
    };

    expect(
      normalizeTournamentDraft({ version: 2, draft: storedDraft }),
    ).toEqual(
      expect.objectContaining({
        prize_tier_id: "world_tour_finals",
        prize_draw_template_id: null,
        prize_player_total: 0,
        prize_rounds: defaultTournamentDraft.prize_rounds,
      }),
    );
  });

  it("keeps an incomplete v2 Challenger selection ready for a draw", () => {
    const storedDraft = {
      ...defaultTournamentDraft,
      prize_tier_id: "challenger_6_none" as const,
      prize_draw_template_id: null,
      prize_player_total: 0,
    };

    expect(
      normalizeTournamentDraft({ version: 2, draft: storedDraft }),
    ).toEqual(
      expect.objectContaining({
        prize_distribution_mode: "generated",
        prize_tier_id: "challenger_6_none",
        prize_draw_template_id: null,
        prize_player_total: 6_000,
        prize_rounds: defaultTournamentDraft.prize_rounds,
      }),
    );
  });

  it("migrates a v1 draft with entered rounds to manual mode without data loss", () => {
    const {
      prize_distribution_mode: _mode,
      prize_tier_id: _tier,
      prize_draw_template_id: _template,
      prize_player_total: _total,
      ...v1Draft
    } = {
      ...defaultTournamentDraft,
      name: "Interrupted draft",
      prize_rounds: { ...defaultTournamentDraft.prize_rounds, qf: 500 },
    };

    const migrated = normalizeTournamentDraft({ version: 1, draft: v1Draft });

    expect(migrated).toEqual(
      expect.objectContaining({
        name: "Interrupted draft",
        prize_distribution_mode: "manual",
        prize_tier_id: null,
        prize_draw_template_id: null,
        prize_player_total: 0,
      }),
    );
    expect(migrated.prize_rounds.qf).toBe(500);
  });

  it("clears editable withholding from v1 drafts", () => {
    const {
      prize_distribution_mode: _mode,
      prize_tier_id: _tier,
      prize_draw_template_id: _template,
      prize_player_total: _total,
      ...v1Draft
    } = { ...defaultTournamentDraft, prize_tax_rate: 30 };

    expect(
      normalizeTournamentDraft({ version: 1, draft: v1Draft }).prize_tax_rate,
    ).toBe(0);
  });

  it("clears editable withholding from unversioned drafts", () => {
    expect(
      normalizeTournamentDraft({ name: "Stored draft", prize_tax_rate: 30 })
        .prize_tax_rate,
    ).toBe(0);
  });

  it("migrates an empty v1 draft into the primary generated flow", () => {
    const {
      prize_distribution_mode: _mode,
      prize_tier_id: _tier,
      prize_draw_template_id: _template,
      prize_player_total: _total,
      ...v1Draft
    } = defaultTournamentDraft;

    expect(
      normalizeTournamentDraft({ version: 1, draft: v1Draft }),
    ).toEqual(
      expect.objectContaining({
        prize_distribution_mode: "generated",
        prize_tier_id: null,
        prize_draw_template_id: null,
        prize_player_total: 0,
      }),
    );
  });

  it.each([
    null,
    "stored draft",
    [],
    { name: null },
    { entry_fee: "100" },
    { entry_fee: -1 },
    { entry_fee: Number.POSITIVE_INFINITY },
    { accommodation_nights: 1.5 },
    { subsidy_covers: "everything" },
    { start_date: "2026-02-30" },
    { prize_rounds: null },
    { prize_rounds: { qf: "500" } },
    { version: 99, draft: defaultTournamentDraft },
  ])("falls back for corrupt or unknown persisted data %#", (stored) => {
    const draft = normalizeTournamentDraft(stored);

    expect(draft).toEqual(
      expect.objectContaining({
        name: "",
        entry_fee: 0,
        subsidy_covers: "flat_stipend",
      }),
    );
    expect(draft.prize_rounds).toEqual({
      r1: 0,
      r2: 0,
      r3: 0,
      qf: 0,
      sf: 0,
      f: 0,
      w: 0,
    });
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

  it("includes prize tax rate in create and edit payloads", () => {
    const payload = toTournamentPayload(
      {
        ...defaultTournamentDraft,
        prize_tax_rate: 30,
      },
      "athlete-1",
    );

    expect(payload.prize_tax_rate).toBe(30);
  });

  it("omits unentered prize rounds from saved projections", () => {
    const payload = toTournamentPayload(
      {
        ...defaultTournamentDraft,
        prize_rounds: { ...defaultTournamentDraft.prize_rounds, r2: 500 },
      },
      "athlete-1",
    );

    expect(payload.prize_rounds).toEqual({ r2: 500 });
  });

  it("sends only entered prize rounds through create and update", async () => {
    const saved = tournament();
    const writer = {
      create: jest.fn().mockResolvedValue(saved),
      update: jest.fn().mockResolvedValue(saved),
    };
    const prize_rounds = { ...defaultTournamentDraft.prize_rounds, r2: 500 };

    await saveTournamentDraft(
      { ...defaultTournamentDraft, prize_rounds },
      "athlete-1",
      writer,
    );
    await saveTournamentDraft(
      { ...defaultTournamentDraft, editId: "tournament-1", prize_rounds },
      "athlete-1",
      writer,
    );

    expect(writer.create).toHaveBeenCalledWith(
      expect.objectContaining({ prize_rounds: { r2: 500 } }),
    );
    expect(writer.update).toHaveBeenCalledWith(
      "tournament-1",
      expect.objectContaining({ prize_rounds: { r2: 500 } }),
    );
  });
});

describe("toTournamentPreviewPayload", () => {
  it("omits zero prize rounds so the server can return its empty scenario state", () => {
    const payload = toTournamentPreviewPayload(
      {
        ...defaultTournamentDraft,
        prize_rounds: { ...defaultTournamentDraft.prize_rounds, qf: 500 },
      },
      "athlete-1",
    );

    expect(payload.prize_rounds).toEqual({ qf: 500 });
  });
});

describe("wizard schemas", () => {
  it("enforces required details, prize tax range, and travel costs", () => {
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
      prizesSchema.safeParse({
        prize_rounds: defaultTournamentDraft.prize_rounds,
        prize_tax_rate: 101,
      }).success,
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
    expect(
      travelSchema.safeParse({
        flight_cost: 0,
        accommodation_nightly: 100,
        accommodation_nights: 1.5,
        accommodation_total: 150,
      }).success,
    ).toBe(false);
  });

  it("requires valid ordered calendar dates and attaches errors to the dates", () => {
    const validDetails = {
      name: "Open Championship",
      location: "Detroit",
      country: "United States",
      currency: "USD",
      start_date: "2024-02-29",
      end_date: "2024-03-01",
      entry_fee: 0,
    };

    expect(detailsSchema.safeParse(validDetails).success).toBe(true);

    const invalidStart = detailsSchema.safeParse({
      ...validDetails,
      start_date: "2026-02-29",
    });
    expect(invalidStart.success).toBe(false);
    expect(invalidStart.error?.issues[0]?.path).toEqual(["start_date"]);

    const reversed = detailsSchema.safeParse({
      ...validDetails,
      start_date: "2026-04-03",
      end_date: "2026-04-01",
    });
    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues[0]?.path).toEqual(["end_date"]);
  });
});
