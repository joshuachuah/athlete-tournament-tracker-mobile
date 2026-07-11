import { differenceInCalendarDays, format } from "date-fns";

import type { PrizeRounds, Scenario, ScenarioResult, TournamentWithPnL } from "@/types";

export const roundLabels: Record<keyof PrizeRounds, string> = {
  r1: "R1",
  r2: "R2",
  r3: "R3",
  qf: "QF",
  sf: "SF",
  f: "Final",
  w: "Win",
};

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const currencyFractionDigits = new Map<string, number>();
const isoDateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function getMoneyFormatter(currency: string): Intl.NumberFormat {
  const cached = moneyFormatters.get(currency);

  if (cached) {
    return cached;
  }

  const formatter = Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: getCurrencyFractionDigits(currency),
  });
  moneyFormatters.set(currency, formatter);
  return formatter;
}

export function formatMoney(amount: number | null | undefined, currency: string): string {
  const code = currency.toUpperCase();

  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return `-- ${code}`;
  }

  const formatted = getMoneyFormatter(code).format(amount);

  return `${formatted} ${code}`;
}

export function formatDate(date: string | Date): string {
  const parsed = typeof date === "string" ? parseDateOnly(date) : date;
  return format(parsed ?? new Date(date), "MMM d, yyyy");
}

export function parseDateOnly(value: string): Date | null {
  const match = isoDateOnlyPattern.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setHours(0, 0, 0, 0);
  parsed.setFullYear(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function dateOnlyYear(value: string): number | null {
  return parseDateOnly(value)?.getFullYear() ?? null;
}

export function calculateDurationDays(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || end < start) {
    return 0;
  }

  return differenceInCalendarDays(end, start) + 1;
}

export function getScenario(
  tournament: TournamentWithPnL,
  scenario: Scenario,
): ScenarioResult | undefined {
  return tournament.pnl.scenarios.find((item) => item.scenario === scenario);
}

export function parseMoneyInput(value: string): number {
  const trimmed = value.trim();

  if (!/^\d*(?:[.,]\d*)?$/.test(trimmed)) {
    return 0;
  }

  const next = Number(trimmed.replace(",", "."));
  return Number.isFinite(next) ? next : 0;
}

function getCurrencyFractionDigits(currency: string): number {
  const code = currency.toUpperCase();
  const cached = currencyFractionDigits.get(code);

  if (cached !== undefined) {
    return cached;
  }

  try {
    const digits = Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits ?? 2;
    currencyFractionDigits.set(code, digits);
    return digits;
  } catch {
    return 2;
  }
}

export function roundCurrencyAmount(amount: number, currency: string): number {
  const factor = 10 ** getCurrencyFractionDigits(currency);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export function isoToday(today: Date = new Date()): string {
  const year = String(today.getFullYear()).padStart(4, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function scenarioLabel(scenario: Scenario): string {
  switch (scenario) {
    case "worst":
      return "Worst";
    case "realistic":
      return "Realistic";
    case "best":
      return "Best";
  }
}
