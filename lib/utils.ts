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

function getMoneyFormatter(currency: string): Intl.NumberFormat {
  const cached = moneyFormatters.get(currency);

  if (cached) {
    return cached;
  }

  const formatter = Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
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
  return format(new Date(date), "MMM d, yyyy");
}

export function calculateDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  return Math.max(1, differenceInCalendarDays(end, start) + 1);
}

export function getScenario(
  tournament: TournamentWithPnL,
  scenario: Scenario,
): ScenarioResult | undefined {
  return tournament.pnl.scenarios.find((item) => item.scenario === scenario);
}

export function parseMoneyInput(value: string): number {
  const next = Number(value.replace(/,/g, ""));
  return Number.isFinite(next) ? next : 0;
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
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
