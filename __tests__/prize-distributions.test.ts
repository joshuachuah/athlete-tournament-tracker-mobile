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
      r1: 831.25,
      r2: 1_306.25,
      qf: 2_137.5,
      sf: 3_562.5,
      f: 5_700,
      w: 9_025,
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

  it("keeps Tour Finals visibly manual-only", () => {
    expect(getPrizeTier("world_tour_finals")).toEqual(
      expect.objectContaining({ drawTemplateId: null, manualOnly: true }),
    );
  });

  it("contains every resolved Challenger accommodation amount", () => {
    expect(
      prizeTiers
        .filter((tier) => tier.category === "challenger")
        .map((tier) => tier.playerPrizeMoney),
    ).toEqual([
      3_000,
      6_000,
      5_500,
      5_000,
      9_000,
      8_250,
      7_500,
      12_000,
      11_000,
      10_000,
      15_000,
      13_750,
      12_500,
    ]);
  });
});
