import { roundCurrencyAmount } from "@/lib/utils";
import type { PrizeRounds } from "@/types";

export const prizeDistributionRevision = "PSA rulebook · August 2025";
export const prizeDistributionCurrency = "USD";

export const drawTemplateIds = [
  "draw_16_entries_16",
  "draw_32_entries_24",
  "draw_32_entries_32",
  "draw_64_entries_48",
  "draw_64_entries_64",
] as const;

export type DrawTemplateId = (typeof drawTemplateIds)[number];
export type PrizeRoundKey = keyof PrizeRounds;
export const prizeRoundKeys: readonly PrizeRoundKey[] = [
  "r1",
  "r2",
  "r3",
  "qf",
  "sf",
  "f",
  "w",
];

export type DrawTemplate = {
  id: DrawTemplateId;
  label: string;
  drawSize: 16 | 32 | 64;
  entries: number;
  requiresByeConfirmation: boolean;
  /** Basis points keep the rulebook's quarter-percent values exact. */
  percentages: Readonly<Partial<Record<PrizeRoundKey, number>>>;
  /** Number of players paid at each finishing position. */
  players: Readonly<Partial<Record<PrizeRoundKey, number>>>;
};

export const drawTemplates = [
  {
    id: "draw_16_entries_16",
    label: "16 draw · 16 entries",
    drawSize: 16,
    entries: 16,
    requiresByeConfirmation: false,
    percentages: { r1: 325, qf: 550, sf: 900, f: 1_400, w: 2_000 },
    players: { r1: 8, qf: 4, sf: 2, f: 1, w: 1 },
  },
  {
    id: "draw_32_entries_24",
    label: "32 draw · 24 entries",
    drawSize: 32,
    entries: 24,
    requiresByeConfirmation: true,
    percentages: {
      r1: 175,
      r2: 275,
      qf: 450,
      sf: 750,
      f: 1_200,
      w: 1_900,
    },
    players: { r1: 8, r2: 8, qf: 4, sf: 2, f: 1, w: 1 },
  },
  {
    id: "draw_32_entries_32",
    label: "32 draw · 32 entries",
    drawSize: 32,
    entries: 32,
    requiresByeConfirmation: false,
    percentages: {
      r1: 125,
      r2: 250,
      qf: 425,
      sf: 700,
      f: 1_150,
      w: 1_750,
    },
    players: { r1: 16, r2: 8, qf: 4, sf: 2, f: 1, w: 1 },
  },
  {
    id: "draw_64_entries_48",
    label: "64 draw · 48 entries",
    drawSize: 64,
    entries: 48,
    requiresByeConfirmation: true,
    percentages: {
      r1: 75,
      r2: 120,
      r3: 210,
      qf: 350,
      sf: 600,
      f: 1_000,
      w: 1_600,
    },
    players: { r1: 16, r2: 16, r3: 8, qf: 4, sf: 2, f: 1, w: 1 },
  },
  {
    id: "draw_64_entries_64",
    label: "64 draw · 64 entries",
    drawSize: 64,
    entries: 64,
    requiresByeConfirmation: false,
    percentages: {
      r1: 50,
      r2: 100,
      r3: 200,
      qf: 350,
      sf: 600,
      f: 1_000,
      w: 1_600,
    },
    players: { r1: 32, r2: 16, r3: 8, qf: 4, sf: 2, f: 1, w: 1 },
  },
] as const satisfies readonly DrawTemplate[];

export type PrizeTierCategory = "world" | "challenger";

export type PrizeTier = {
  id: string;
  category: PrizeTierCategory;
  label: string;
  playerPrizeMoney: number;
  drawTemplateId: DrawTemplateId | null;
  manualOnly?: boolean;
};

export const prizeTiers = [
  {
    id: "world_copper",
    category: "world",
    label: "Copper",
    playerPrizeMoney: 23_750,
    drawTemplateId: "draw_32_entries_24",
  },
  {
    id: "world_bronze",
    category: "world",
    label: "Bronze",
    playerPrizeMoney: 47_500,
    drawTemplateId: "draw_32_entries_24",
  },
  {
    id: "world_silver",
    category: "world",
    label: "Silver",
    playerPrizeMoney: 71_250,
    drawTemplateId: "draw_32_entries_24",
  },
  {
    id: "world_gold",
    category: "world",
    label: "Gold",
    playerPrizeMoney: 95_000,
    drawTemplateId: "draw_32_entries_24",
  },
  {
    id: "world_platinum",
    category: "world",
    label: "Platinum",
    playerPrizeMoney: 181_500,
    drawTemplateId: "draw_32_entries_32",
  },
  {
    id: "world_diamond",
    category: "world",
    label: "Diamond",
    playerPrizeMoney: 285_000,
    drawTemplateId: "draw_64_entries_48",
  },
  {
    id: "world_tour_finals",
    category: "world",
    label: "Tour Finals",
    playerPrizeMoney: 285_000,
    drawTemplateId: null,
    manualOnly: true,
  },
  {
    id: "world_championships",
    category: "world",
    label: "World Championships",
    playerPrizeMoney: 570_000,
    drawTemplateId: "draw_64_entries_64",
  },
  {
    id: "challenger_3_none",
    category: "challenger",
    label: "Challenger 3 · No accommodation",
    playerPrizeMoney: 3_000,
    drawTemplateId: null,
  },
  {
    id: "challenger_6_none",
    category: "challenger",
    label: "Challenger 6 · No accommodation",
    playerPrizeMoney: 6_000,
    drawTemplateId: null,
  },
  {
    id: "challenger_6_billeting",
    category: "challenger",
    label: "Challenger 6 · Billeting",
    playerPrizeMoney: 5_500,
    drawTemplateId: null,
  },
  {
    id: "challenger_6_hotel",
    category: "challenger",
    label: "Challenger 6 · Hotel",
    playerPrizeMoney: 5_000,
    drawTemplateId: null,
  },
  {
    id: "challenger_9_none",
    category: "challenger",
    label: "Challenger 9 · No accommodation",
    playerPrizeMoney: 9_000,
    drawTemplateId: null,
  },
  {
    id: "challenger_9_billeting",
    category: "challenger",
    label: "Challenger 9 · Billeting",
    playerPrizeMoney: 8_250,
    drawTemplateId: null,
  },
  {
    id: "challenger_9_hotel",
    category: "challenger",
    label: "Challenger 9 · Hotel",
    playerPrizeMoney: 7_500,
    drawTemplateId: null,
  },
  {
    id: "challenger_12_none",
    category: "challenger",
    label: "Challenger 12 · No accommodation",
    playerPrizeMoney: 12_000,
    drawTemplateId: null,
  },
  {
    id: "challenger_12_billeting",
    category: "challenger",
    label: "Challenger 12 · Billeting",
    playerPrizeMoney: 11_000,
    drawTemplateId: null,
  },
  {
    id: "challenger_12_hotel",
    category: "challenger",
    label: "Challenger 12 · Hotel",
    playerPrizeMoney: 10_000,
    drawTemplateId: null,
  },
  {
    id: "challenger_15_none",
    category: "challenger",
    label: "Challenger 15 · No accommodation",
    playerPrizeMoney: 15_000,
    drawTemplateId: null,
  },
  {
    id: "challenger_15_billeting",
    category: "challenger",
    label: "Challenger 15 · Billeting",
    playerPrizeMoney: 13_750,
    drawTemplateId: null,
  },
  {
    id: "challenger_15_hotel",
    category: "challenger",
    label: "Challenger 15 · Hotel",
    playerPrizeMoney: 12_500,
    drawTemplateId: null,
  },
] as const satisfies readonly PrizeTier[];

export type PrizeTierId = (typeof prizeTiers)[number]["id"];
export type PrizeDistributionMode = "generated" | "manual";

const drawTemplateIdSet = new Set<string>(drawTemplateIds);
const prizeTierIdSet = new Set<string>(prizeTiers.map((tier) => tier.id));

export function isDrawTemplateId(value: string): value is DrawTemplateId {
  return drawTemplateIdSet.has(value);
}

export function isPrizeTierId(value: string): value is PrizeTierId {
  return prizeTierIdSet.has(value);
}

export function getDrawTemplate(id: DrawTemplateId): DrawTemplate {
  const template = drawTemplates.find((candidate) => candidate.id === id);

  if (!template) {
    throw new Error(`Unknown prize draw template: ${id}`);
  }

  return template;
}

export function getPrizeTier(id: PrizeTierId): PrizeTier {
  const tier = prizeTiers.find((candidate) => candidate.id === id);

  if (!tier) {
    throw new Error(`Unknown prize tier: ${id}`);
  }

  return tier;
}

export function distributionTotalBasisPoints(template: DrawTemplate): number {
  return prizeRoundKeys.reduce(
    (total, round) =>
      total +
      (template.percentages[round] ?? 0) * (template.players[round] ?? 0),
    0,
  );
}

export function generatePrizeRounds(
  playerPrizeMoney: number,
  templateId: DrawTemplateId,
  currency: string,
): PrizeRounds {
  if (!Number.isFinite(playerPrizeMoney) || playerPrizeMoney <= 0) {
    throw new RangeError("Player prize money must be a positive finite number.");
  }

  const template = getDrawTemplate(templateId);
  const rounds: PrizeRounds = {};

  for (const round of prizeRoundKeys) {
    const basisPoints = template.percentages[round];

    if (basisPoints !== undefined) {
      rounds[round] = roundCurrencyAmount(
        (playerPrizeMoney * basisPoints) / 10_000,
        currency,
      );
    }
  }

  return rounds;
}
