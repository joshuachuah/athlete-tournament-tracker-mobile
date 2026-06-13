import { detailsSchema, prizesSchema } from "@/lib/tournament-draft";
import { zodErrorMap } from "@/lib/zod-errors";

describe("zodErrorMap", () => {
  it("maps flat schema failures to the wizard message", () => {
    const result = detailsSchema.safeParse({
      name: "",
      location: "Detroit",
      country: "United States",
      currency: "USD",
      start_date: "2026-04-01",
      end_date: "2026-04-03",
      entry_fee: 0,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(zodErrorMap(result.error).name).toBe("Required.");
  });

  it("maps nested schema failures using dotted paths", () => {
    const result = prizesSchema.safeParse({
      prize_rounds: {
        r1: -5,
        r2: 0,
        r3: 0,
        qf: 0,
        sf: 0,
        f: 0,
        w: 0,
      },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(zodErrorMap(result.error)["prize_rounds.r1"]).toBe(
      "Must be zero or more.",
    );
  });
});
