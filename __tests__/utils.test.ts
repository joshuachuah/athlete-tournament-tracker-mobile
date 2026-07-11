import {
  calculateDurationDays,
  dateOnlyYear,
  formatDate,
  formatMoney,
  isoToday,
  parseMoneyInput,
  parseDateOnly,
} from "@/lib/utils";

describe("date-only utilities", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("uses local calendar fields instead of UTC serialization", () => {
    const nearMidnight = new Date("2026-07-10T16:30:00.000Z");
    jest.spyOn(nearMidnight, "getFullYear").mockReturnValue(2026);
    jest.spyOn(nearMidnight, "getMonth").mockReturnValue(6);
    jest.spyOn(nearMidnight, "getDate").mockReturnValue(11);

    expect(isoToday(nearMidnight)).toBe("2026-07-11");
  });

  it("formats a date-only value without previous-day rollover in the Americas", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(parseDateOnly("2026-01-01")?.getDate()).toBe(1);
  });

  it("accepts leap day and rejects impossible calendar dates", () => {
    expect(parseDateOnly("2024-02-29")).not.toBeNull();
    expect(parseDateOnly("2026-02-29")).toBeNull();
    expect(parseDateOnly("2026-04-31")).toBeNull();
  });

  it("extracts years without crossing a timezone boundary", () => {
    expect(dateOnlyYear("2026-01-01")).toBe(2026);
    expect(dateOnlyYear("not-a-date")).toBeNull();
  });

  it("does not turn invalid or reversed ranges into one-day events", () => {
    expect(calculateDurationDays("2026-04-01", "2026-04-03")).toBe(3);
    expect(calculateDurationDays("2026-04-03", "2026-04-01")).toBe(0);
    expect(calculateDurationDays("2026-02-29", "2026-03-01")).toBe(0);
  });

  it("keeps actual Date inputs compatible with formatDate", () => {
    expect(formatDate(new Date(2026, 0, 1))).toBe("Jan 1, 2026");
  });
});

describe("money formatting", () => {
  it("keeps whole amounts compact and preserves ISO currency precision", () => {
    expect(formatMoney(4800, "USD")).toBe("$4,800 USD");
    expect(formatMoney(99.99, "USD")).toBe("$99.99 USD");
    expect(formatMoney(99.99, "JPY")).toBe("¥100 JPY");
    expect(formatMoney(10.125, "KWD")).toBe("KWD\u00a010.125 KWD");
  });
});

describe("money input parsing", () => {
  it("treats dots and commas as decimal separators without grouping", () => {
    expect(parseMoneyInput("10.50")).toBe(10.5);
    expect(parseMoneyInput("10,50")).toBe(10.5);
    expect(parseMoneyInput("10,5.0")).toBe(0);
    expect(parseMoneyInput("")).toBe(0);
  });
});
