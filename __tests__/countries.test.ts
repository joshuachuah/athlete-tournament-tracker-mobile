import {
  countries,
  estimatedWithholdingAfterCountryChange,
  getCountryByCode,
  getCountryByName,
  isCountryCode,
} from "@/lib/countries";

describe("bundled country data", () => {
  it("contains the complete ISO 3166-1 alpha-2 list without duplicate codes", () => {
    expect(countries).toHaveLength(249);
    expect(new Set(countries.map((country) => country.code)).size).toBe(249);
  });

  it("supports name and code lookup locally", () => {
    expect(getCountryByCode("my")?.name).toBe("Malaysia");
    expect(getCountryByName("United States")?.code).toBe("US");
  });

  it("keeps the stored country-code type canonical", () => {
    expect(isCountryCode("US")).toBe(true);
    expect(isCountryCode("us")).toBe(false);
  });
});

describe("country-driven estimated withholding", () => {
  it("sets and locks the US estimate at 30 percent", () => {
    expect(estimatedWithholdingAfterCountryChange("MY", "US", 12)).toBe(30);
    expect(estimatedWithholdingAfterCountryChange("US", "US", 30)).toBe(30);
  });

  it("clears the estimate when leaving the US", () => {
    expect(estimatedWithholdingAfterCountryChange("US", "MY", 30)).toBeNull();
  });

  it("clears null, zero, and nonzero rates between different non-US countries", () => {
    expect(estimatedWithholdingAfterCountryChange("MY", "GB", null)).toBeNull();
    expect(estimatedWithholdingAfterCountryChange("MY", "GB", 0)).toBeNull();
    expect(estimatedWithholdingAfterCountryChange("MY", "GB", 12)).toBeNull();
  });

  it.each([null, 0, 12])(
    "preserves %p when reselecting the same non-US country",
    (rate) => {
      expect(estimatedWithholdingAfterCountryChange("MY", "MY", rate)).toBe(
        rate,
      );
    },
  );
});
