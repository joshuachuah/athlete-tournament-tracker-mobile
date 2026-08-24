import {
  distributionTotalBasisPoints,
  drawTemplates,
  generatePrizeRounds,
  getPrizeTier,
  prizeTiers,
} from "@/lib/prize-distributions";

describe("PSA prize distributions", () => {
  it.each(drawTemplates)("$label pays exactly 100% across the draw", (template) => {
    expect(distributionTotalBasisPoints(template)).toBe(10_000);
  });

  it("generates the 16-draw fixture without absent rounds", () => {
    expect(generatePrizeRounds(10_000, "draw_16_entries_16", "USD")).toEqual({
      r1: 325,
      qf: 550,
      sf: 900,
      f: 1_400,
      w: 2_000,
    });
  });

  it("generates the Bronze fixture at cent precision", () => {
    const bronze = getPrizeTier("world_bronze");
    const templateId = bronze.drawTemplateId;

    if (!templateId) {
      throw new Error("Bronze must define a draw template.");
    }

    expect(
      generatePrizeRounds(
        bronze.playerPrizeMoney,
        templateId,
        "USD",
      ),
    ).toEqual({
      r1: 997.5,
      r2: 1_567.5,
      qf: 2_565,
      sf: 4_275,
      f: 6_840,
      w: 10_830,
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid player prize base of %p",
    (base) => {
      expect(() =>
        generatePrizeRounds(base, "draw_16_entries_16", "USD"),
      ).toThrow("Player prize money must be a positive finite number.");
    },
  );

  it("generates the published Tour Finals placement schedule", () => {
    const tier = getPrizeTier("world_tour_finals");

    expect(
      generatePrizeRounds(
        tier.playerPrizeMoney,
        "tour_finals_8_entries_8",
        "USD",
      ),
    ).toEqual({
      p7_8: 16_625,
      p5_6: 24_937.5,
      p3_4: 41_562.5,
      f: 66_500,
      w: 99_750,
    });
  });

  it("matches every August 2026 Challenger prize and draw rule", () => {
    expect(
      prizeTiers
        .filter((tier) => tier.category === "challenger")
        .map((tier) => [
          tier.id,
          tier.onSitePrizeMoney,
          tier.playerPrizeMoney,
          tier.allowedDrawTemplateIds,
        ]),
    ).toEqual([
      ["challenger_3_none", 3_000, 3_000, ["draw_16_entries_16", "draw_32_entries_24"]],
      ["challenger_6_none", 6_000, 6_000, ["draw_16_entries_16", "draw_32_entries_24"]],
      ["challenger_6_billeting", 5_500, 6_000, ["draw_16_entries_16", "draw_32_entries_24"]],
      ["challenger_6_hotel", 5_000, 6_000, ["draw_16_entries_16", "draw_32_entries_24"]],
      ["challenger_9_none", 9_000, 9_000, ["draw_32_entries_24"]],
      ["challenger_9_billeting", 8_250, 9_000, ["draw_32_entries_24"]],
      ["challenger_9_hotel", 7_500, 9_000, ["draw_32_entries_24"]],
      ["challenger_12_none", 12_000, 12_000, ["draw_32_entries_24"]],
      ["challenger_12_billeting", 11_000, 12_000, ["draw_32_entries_24"]],
      ["challenger_12_hotel", 10_000, 12_000, ["draw_32_entries_24"]],
      ["challenger_15_none", 15_000, 15_000, ["draw_32_entries_24"]],
      ["challenger_15_billeting", 13_750, 15_000, ["draw_32_entries_24"]],
      ["challenger_15_hotel", 12_500, 15_000, ["draw_32_entries_24"]],
      ["challenger_18_none", 18_000, 18_000, ["draw_32_entries_24"]],
      ["challenger_18_billeting", 16_500, 18_000, ["draw_32_entries_24"]],
      ["challenger_18_hotel", 15_000, 18_000, ["draw_32_entries_24"]],
    ]);
  });

  it.each(
    prizeTiers.filter((tier) => tier.category === "world"),
  )("derives $label player payouts from 95% of on-site prize", (tier) => {
    expect(tier.playerPrizeMoney).toBe(tier.onSitePrizeMoney * 0.95);
  });

});
